# Branch visual review · 2026-10-26

No required player-facing fixes found in the reviewed branch images and phone crops.

This was an independent visual review of the stable production captures. Runtime, story and art were read-only. No additional browser tests were run for this review.

## Material reviewed

- All seven `contact-sheets/branch-B1.jpg` through `branch-B7.jpg` sheets, covering each alternative life from its major decision through its ending.
- `contact-sheets/other-responses-1.jpg`, covering the seven other local-response scenes.
- `contact-sheets/small-checks.jpg`, covering the 320×568 large-text choices and selected endings.
- Full-size captures: `390-standard/screens/B4_05.jpg`, `B6_07.jpg`, `B7_04.jpg`, plus `320-large/screens/B6_02.jpg` and `B1_01.jpg`.
- The seven ending variants and `b6_work` reuse explanation in the frozen canonical story, to check whether both local responses fit their shared closing image.

## Findings by route

| Route | Visual and narrative assessment |
| --- | --- |
| B1 · 自己的日子 | The school manuscript, ordinary first job, return home and pen on the old pages form a clear sequence. The 2007, 2013 and 2020 settings and character ages progress plausibly. Both asking for requirements and drafting first have suitable closing text over the writing close-up. |
| B2 · 写作者 | The work-and-writing routine, marked-up manuscript, finished pages, public reading and listener reaction support the route. The ending changes to the audience rather than repeating the reader portrait. The 2011–2019 progression is legible. |
| B3 · 历史研究者 | The application reply, archives, source detail, library work and written reply each support the corresponding action. Both following a source and narrowing the question fit the reply-writing ending. |
| B4 · 职业经理人 | Discussion, scope marking, listening, handover and closing the notebook are distinct actions. The partner's dialogue fits the listening shot. The 2016 and 2021 moments are separated by date and the older character appearance. |
| B5 · 产品创业者 | The choice concerns actual product work. Messages, feature sketches, a user call, a wider office view and shared feedback make that work visible. The earlier phone and later notched phone fit the stated years. Both local decisions fit the shared feedback ending. |
| B6 · 幕后建设者 | Declining the auction, dividing work, declining another invitation that night and returning to listen form a coherent route. The pointing close-up and listening shot show different actions. The repeated `b6_work` shot at the decision and ending is an intentional return to the same table, rather than an unrelated scene substitution. |
| B7 · 另一种日常 | Handover precedes free time. Reading and walking have separate images. Green foliage in the earlier walk and yellow leaves in the autumn closing sequence support the time change. The final rear view gives the route a distinct ending. |

## Phone presentation

In the reviewed 320×568 large-text captures, subtitles and choices are complete and legible. The long U05 and B6_02 choices remain inside the frame. B1_01 keeps its chapter label, current action, photo and continue control. The selected endings retain their title, closing text and replay controls.

The compact phone layout makes the photo narrower when the text needs more space. This is visible in `small-checks.jpg`, but the reviewed faces and action context remain identifiable. No text/face collision or required-action crop was found in these samples.

The Chinese is concrete and readable in the reviewed scenes. The alternative responses change what the player does, and their closing callbacks fit the same ending photos. No missing action, contradictory time jump or unexplained cross-era image reuse was found.

## Metadata correction

`assets.b6_work.reuseReason` still mentions a middle “时间黑场”. The current B6_05 correctly uses a photo of declining an invitation on the phone. That source explanation should name the phone shot instead. This is a documentation correction, not a player-facing visual blocker.

## Limits

This review covers captured composition, copy and sequence continuity. It does not certify historical-photo authenticity, physical-device rendering, Safari behavior or the separate production regression suite. The alternative local-response images and all seven ending texts were checked, but this review did not create additional captures of every ending variant. Root's route capture and production tests provide the separate runtime evidence.

Root follow-up: the stale b6_work reuse explanation was corrected before final packaging. Balanced wrapping was then recaptured across all scenes at both sizes; H10B was shortened and recaptured separately. No scene-art or branch-logic change was needed.
