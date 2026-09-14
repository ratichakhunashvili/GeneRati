import { NextResponse } from 'next/server';
import { readJson, requireSession, validateActivity } from '@/lib/api';
import { driveClient, formsClient, googleErrorMessage } from '@/lib/google';
import { formatDateKa, formatTime, slugify } from '@/lib/format';

export const maxDuration = 60;

/** A short-answer question item. */
function textQuestion(title, required) {
  return {
    title,
    questionItem: { question: { required, textQuestion: { paragraph: false } } },
  };
}

export async function POST(request) {
  const { session, error: authError } = await requireSession();
  if (authError) return authError;

  const { body, error: bodyError } = await readJson(request);
  if (bodyError) return bodyError;

  const { activityTitle, date, time, location, folderId } = body ?? {};

  const invalid = validateActivity({ title: activityTitle, date, time, location });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const forms = formsClient(session.accessToken);
  const drive = driveClient(session.accessToken);

  try {
    // The Forms API accepts only `info` at creation; description and questions
    // must be added in a follow-up batchUpdate.
    const created = await forms.forms.create({
      requestBody: {
        info: {
          title: `${activityTitle} — რეგისტრაცია`,
          documentTitle: `${slugify(activityTitle)} — რეგისტრაცია`,
        },
      },
    });

    const formId = created.data.formId;

    await forms.forms.batchUpdate({
      formId,
      requestBody: {
        requests: [
          {
            updateFormInfo: {
              info: {
                description:
                  `${formatDateKa(date)} · ${formatTime(time)} · ${location}\n` +
                  'ორგანიზატორი: SkillWill College',
              },
              updateMask: 'description',
            },
          },
          { createItem: { item: textQuestion('სახელი და გვარი', true), location: { index: 0 } } },
          { createItem: { item: textQuestion('ელ. ფოსტა', true), location: { index: 1 } } },
          { createItem: { item: textQuestion('ტელეფონი', false), location: { index: 2 } } },
          {
            createItem: {
              item: {
                title: 'დაესწრებით?',
                questionItem: {
                  question: {
                    required: true,
                    choiceQuestion: {
                      type: 'RADIO',
                      options: [
                        { value: 'დიახ' },
                        { value: 'შესაძლოა' },
                        { value: 'ვერ დავესწრები' },
                      ],
                    },
                  },
                },
              },
              location: { index: 3 },
            },
          },
        ],
      },
    });

    // Forms are created at the Drive root, so move it into the activity folder.
    // A failure here is cosmetic — the form itself works — so it must not fail
    // the whole request.
    let movedToFolder = false;
    if (folderId) {
      try {
        const meta = await drive.files.get({ fileId: formId, fields: 'parents' });
        await drive.files.update({
          fileId: formId,
          addParents: folderId,
          removeParents: (meta.data.parents || []).join(','),
          fields: 'id, parents',
        });
        movedToFolder = true;
      } catch (moveErr) {
        console.warn('[create-form] Could not move form into folder:', googleErrorMessage(moveErr));
      }
    }

    return NextResponse.json({
      success: true,
      formId,
      formLink: created.data.responderUri,
      editLink: `https://docs.google.com/forms/d/${formId}/edit`,
      movedToFolder,
    });
  } catch (err) {
    console.error('[create-form] Form creation failed:', err);
    return NextResponse.json({ error: googleErrorMessage(err) }, { status: 500 });
  }
}
