# Editorial methodologies for an AI video editor

Research note for a machine-actionable editing planner. The central design principle is to treat editing as constrained optimization, not a bag of transitions: preserve intelligibility and truth first, then optimize emotion, story, rhythm, attention, and style. Most craft “rules” are defaults. A deliberate discontinuity is valid when the requested effect outweighs its comprehension cost.

## 1. A machine-actionable editorial model

### Represent the source material

Index every source at frame or sub-shot resolution where practical:

- **Time:** source in/out, capture time/timecode, transcript word times, shot boundaries, scene/event boundaries.
- **People and speech:** speaker identity/confidence, active speaker, visible listener, words, sentence/idea boundaries, disfluencies, pauses, sentiment/emotion, gaze direction, face visibility, lip-sync risk.
- **Space and action:** location, camera/angle ID, shot scale, subject position, screen direction, eyeline vector, action phase, object state, entrance/exit, camera motion, visual motion.
- **Image and sound quality:** focus, exposure, stability, occlusion, noise, clipping, room tone, music/SFX, duplicate/near-duplicate frames.
- **Meaning and provenance:** topic/claim, entities, event chronology, semantic relevance, source file, factual context, consent/restriction/licence, whether audio and picture are synchronous.
- **Editorial utility:** best-take score, reaction, establishing shot, insert, cutaway, B-roll, archival, transition, possible hook/payoff, safe handles before/after.

Do not let the vision/language model silently discard low-confidence material. The International Documentary Association warns that AI tends to surface machine-legible footage—clear speech, recognizable faces, repeated patterns—while overlooking ambiguous, quiet, embodied, or context-dependent moments. Preserve a searchable “uncertain/unclassified” pool and expose why clips were ranked.

### Separate hard constraints from soft objectives

**Hard unless explicitly overridden:** no missing media; legal/consent restrictions; required duration/aspect; A/V sync; no contradictory object/action state in an intended continuous action; no fabricated documentary response or altered factual meaning; dialogue remains intelligible.

**Soft, weighted by intent:** emotion, story progress, rhythm, eye trace, 2-D screen continuity, 3-D space, performance, novelty, relevance, brand/style, retention, production quality. Walter Murch’s often-cited priority order—emotion, story, rhythm, eye trace, 2-D plane, 3-D space—is a useful conflict resolver: spatial perfection should usually lose to a stronger truthful performance, not vice versa.

Example candidate-cut score (all terms normalized, weights profile-specific):

```text
score(cut) =
  wE*emotion_fit + wS*story_gain + wR*rhythm_fit + wP*performance
  + wG*gaze_and_eye_trace + wC*continuity + wA*audio_smoothness
  + wN*novel_information + wV*visual_quality
  - penalties(sync_error, semantic_jump, redundancy, deception_risk,
              orientation_cost, lip_mismatch, flash_frame, rights_risk)
```

Generate at least two structurally distinct candidates when confidence is low (for example, performance-led and pace-led), then evaluate globally. Greedy “best next shot” selection creates locally attractive but repetitive or incoherent sequences.

### Use an explicit edit grammar

Planner operations should include `hard_cut`, `match_action`, `shot_reverse`, `cutaway`, `insert`, `reaction`, `j_cut`, `l_cut`, `parallel_cut`, `jump_cut`, `graphic_match`, `montage`, `dissolve/fade`, `hold`, `reframe`, `time_compress`, and `time_expand`. Every operation should store:

- narrative purpose (`orient`, `reveal`, `explain`, `contrast`, `compress_time`, `increase_tension`, `hide_removal`, etc.);
- evidence for the decision;
- continuity violations and their intentionality;
- source provenance for picture and audio;
- a reversible edit-decision-list representation.

## 2. Classical continuity editing

Continuity editing makes cuts comparatively invisible and preserves coherent story space and time. It should be the default for dialogue, demonstrations, procedural action, and factual explanation.

### Spatial continuity rules

- **Establish before fragmenting.** Use a master/establishing shot when location or participant geometry is not already inferable. Re-establish after a major axis change, new participant, long interruption, or move to a new subspace.
- **180-degree rule.** Infer the axis of action between participants or along movement. In a continuous scene, prefer cameras on one side so screen positions/directions remain stable. Cross only with a neutral-on-axis shot, visible camera/subject movement across the line, a new establishing shot, or an intentional disorientation flag.
- **30-degree rule.** When cutting between views of the same subject, change camera angle by roughly 30° or change shot scale/composition materially; otherwise the image can appear to stutter as an accidental jump cut. Treat 30° as a conventional warning threshold, not a geometric guarantee.
- **Eyeline match.** A character looking frame right should cut to the expected target in the implied direction, and conversational partners should appear to face each other. Check gaze direction, vertical angle, and likely target, not just bounding-box position.
- **Screen direction.** Preserve left-to-right/right-to-left travel across cuts unless the shot visibly shows a turn or the edit is meant to imply collision/opposition.
- **Background and lighting continuity.** Penalize implausible background, light-direction, wardrobe, prop, and body-position changes across supposedly adjacent shots.

### Temporal and action continuity

- **Match on action.** Cut during a motivated movement and continue the same action phase from the new angle. Align pose/object trajectory and avoid repeated or missing motion unless time manipulation is intentional. Motion can mask the edit and pull attention through it.
- **Preserve causal order.** For `setup → action → consequence → reaction`, do not reveal the consequence early unless suspense/irony calls for it. Maintain object state and participant knowledge over time.
- **Ellipsis.** Compress routine action after its intention and result are clear. Enter scenes late and leave once the dramatic value is delivered, while retaining the minimum context needed to understand who/where/why.
- **Shot/reverse shot.** Alternate speaker, listener, or point-of-view shots with matched eyelines. Do not mechanically cut on every speaker change; hold a two-shot for relationship or cut to the listener when the reception of a line carries more story value than its delivery.
- **Eye trace.** Prefer the incoming point of interest near the outgoing fixation point, especially across fast cuts. If the focus must move far, provide time, motion, sound, or composition to guide it.

### Continuity validation signals

Measure per cut:

- axis-side sign and confidence;
- gaze-target angular error;
- screen-direction agreement;
- subject-position displacement normalized by frame diagonal;
- shot-scale difference and camera-angle delta;
- pose/action-phase and object-state consistency;
- luminance/color/background discontinuity;
- optical-flow direction and magnitude around the cut;
- audio loudness, room-tone, ambience, and phase discontinuity.

Flag clusters rather than blindly reject a cut: a great action match can legitimately tolerate a larger background change, while several simultaneous mismatches usually signal a bad continuity edit.

## 3. Discontinuity and expressive editing

Discontinuity foregrounds construction or deliberately fractures space/time. It is appropriate for energy, comedy, memory, alienation, subjectivity, compression, or conceptual association.

- **Jump cut:** remove time within substantially the same framing. Use to accelerate, show repetition, expose artifice, or create unease. Hide an unwanted jump with B-roll/cutaway only when the desired style is continuous.
- **False match/action or eyeline:** visually promises continuity, then reveals another time/place or impossible relation. Use only when the semantic surprise is legible.
- **Graphic match:** join similar shape, color, composition, motion, or sound across discontinuous scenes. Score visual correspondence plus conceptual relevance; resemblance without story meaning feels decorative.
- **Smash cut:** abrupt contrast in scale, loudness, motion, time, or mood for shock/comedy. Protect against accidental loudness spikes and misleading causal implication.
- **Elliptical fragments:** omit connective material so the audience reconstructs events. Increase contextual anchors if target audience, subject complexity, or factual stakes make inference risky.

Planner rule: every continuity violation must carry an `intended_effect` and a predicted `comprehension_cost`. If no effect is identified, repair or surface for review.

## 4. Story structure and scene construction

Do not force every project into a three-act template. Model a story as changing questions, goals, knowledge, and emotional state.

### Story units

```text
beat = {setup/state, agent_goal_or_question, new_information_or_action,
        turn/complication, consequence, emotional_change, open_loops, payoff_links}
scene = ordered beats with one dominant function and a changed end state
sequence = scenes advancing a larger question/goal
```

For each candidate beat ask:

1. What does the audience need to know before this?
2. What new information, feeling, decision, or causal event does it add?
3. What expectation/question does it open, sharpen, reverse, or pay off?
4. Is this the latest viable entrance and earliest satisfying exit?
5. If removed, does comprehension, emotion, causality, characterization, or required evidence deteriorate?

### Robust structures

- **Goal–obstacle–choice–consequence:** good for narrative action and profiles.
- **Question–investigation–evidence–complication–answer/implication:** good for documentary, news, and explainers.
- **Before–process–after:** good for transformations and tutorials; include proof of the result.
- **Claim–evidence–counterpoint–synthesis:** good for argument; preserve the strength and context of opposing evidence.
- **Setup–escalation–climax–release:** useful at scene and whole-video scale.
- **Hook–promise–delivery–payoff/next step:** useful for short-form, but the opening promise must match the content.

Alternate information and emotion. Repetition is justified when it escalates, reframes, creates pattern, or lets emotion land; otherwise collapse it. A section that only restates prior information without stronger evidence or feeling should receive a high trim penalty.

### Global structure checks

- prerequisite facts precede dependents;
- major people/places are introduced before unexplained use;
- open loops are eventually paid off or intentionally left unresolved;
- chronology changes are signposted;
- stakes and central question remain recoverable;
- climax/payoff receives enough setup and screen time;
- ending changes or completes the opening idea rather than merely stopping.

BBC documentary guidance describes an efficient rough workflow: first assemble spoken material and actuality into a working story, accepting rough edges and excess length, then refine pictures, music, repetition, and timing. This argues for a two-pass planner: **radio/story cut first, visual/rhythm cut second**, followed by truth and continuity validation.

## 5. Documentary and interview editing

### Recommended workflow

1. Transcribe with word times, speaker diarization, nonverbal events, uncertainty, and source timecodes.
2. Log themes, claims, evidence, emotional beats, chronology, names, restrictions, quality, and possible visuals. Preserve full-question/full-answer context.
3. Build select reels/string-outs by topic and character; include handles and neighboring context, not isolated quotable sentences.
4. Create a paper/radio edit from the strongest truthful bites and actuality. Prefer complete, natural thoughts; retain interviewer questions when needed for meaning.
5. Test the audio-only story for clarity, momentum, and fair representation.
6. Add scenes/observational actuality, archival material, B-roll, graphics, and music because they add evidence, place, contrast, emotion, or visual continuity—not merely to wallpaper speech.
7. Verify every factual/ethical seam against the source context before polish.

The BBC recommends a shot list/storyboard, organized rushes, timecoded shot list, transcript, and paper edit. These are direct product requirements: make transcript selections traceable to source and let the planner export/import a paper edit.

### Selecting and arranging interview bites

Prefer bites that are concise but retain the speaker’s intended proposition, qualification, tense, referent, and emotional cadence. Remove filler or repetition only when the splice remains natural and does not create a stronger, cleaner, or different claim than the speaker made.

Useful sequence roles:

- **orientation:** who/where/what;
- **specific scene/anecdote:** concrete action and sensory detail;
- **interpretation:** why it matters;
- **evidence/corroboration:** records, actuality, another source;
- **counterpoint/uncertainty:** credible tension or limit;
- **reflection/change:** what the speaker now understands or wants.

Intercut speakers by completing or productively contradicting thoughts, but never synthetically imply that two separately recorded people directly responded to one another. Label constructed parallelism internally.

### Documentary truth constraints

- Never pair a question with an answer from another context if the new pairing changes its meaning.
- Never insert unrelated silence, reaction, or B-roll to imply hesitation, guilt, ignorance, or behavior that did not occur. IDA’s discussion of *Under the Gun* documents the reputational and legal consequences of substituting calibration footage to imply a non-existent pause.
- Do not change chronology without signaling it when sequence is materially meaningful.
- Distinguish illustrative B-roll from evidence. A generic image must not appear to document the stated event.
- Preserve hedges (“I think,” “may,” “at the time”), negation, and attribution; transcript-based compression often deletes exactly these.
- Keep an audit trail linking every output word and frame to source, with enough surrounding context for review.
- Flag synthetic, reenacted, licensed, archival, and generated material in metadata and honor disclosure policy.
- Evaluate representation: whose account is missing, whose screen time is disproportionate, and whether machine-confidence ranking has buried difficult but important material.

High-risk transformations—sensitive allegation, adversarial interview, changed chronology, sentence construction across distant takes, or emotionally loaded reaction substitution—should require human approval.

## 6. Dialogue and performance editing

The main unit is not “a line”; it is a dramatic exchange among speaking, listening, silence, action, and reaction.

- Select performance for believable intention and emotional progression before technical perfection. Then repair small spatial or timing flaws with cutaways, reaction shots, room tone, or alternate coverage.
- Maintain conversational cadence. Remove dead air that adds nothing, but preserve breaths, searches, interruptions, and silences that express thought, discomfort, comedy, or power.
- Cut to a speaker when delivery matters; cut to a listener when reception/subtext matters. A reaction must be temporally and ethically compatible with the line it appears to answer.
- Use two-shots/masters to establish relationship and simultaneous behavior; singles for intimacy, emphasis, control, or clean construction.
- Avoid ping-pong cutting solely on turn boundaries. Vary shot size and timing at changes in idea, emotion, power, gaze, or action.
- Protect lip sync: if dialogue comes from another take or time, cover visible mouths with a legitimate listener, wide shot, insert, or B-roll. Do not use an unrelated reaction to make a factual claim feel true.
- Smooth constructed speech with natural breaths, room tone, ambience continuity, and short audio fades. Check plosive truncation, doubled consonants, chopped reverb, noise-floor pumping, and robotic cadence.
- Prefer an L-cut to see a response while the speaker finishes; prefer a J-cut to let the upcoming speaker/location motivate the visual transition.

Dialogue QC signals: words-per-minute by segment, pause distribution, interruption overlap, cut distance from word/phoneme boundary, room-tone delta, lip/audio offset, speaker-turn-to-camera-cut correlation, reaction-context confidence, and repeated shot-pattern entropy.

## 7. J-cuts, L-cuts, sound bridges, and B-roll

### Split edits

- **J-cut:** incoming audio starts before incoming picture. It creates anticipation, motivates the next image/location, or gives the viewer a processing bridge.
- **L-cut:** outgoing audio continues over the next picture. It preserves flow, shows a listener/reaction/context while speech continues, or lets the prior scene emotionally color the next.
- **Sound bridge:** music, ambience, or effects span the picture cut to imply continuity even when image/time/location changes. Cognitive research notes that continuous soundtrack can support perceived temporal continuity across visual discontinuity.

Choose overlap duration from syntax, breath, ambience, and dramatic function—never a universal frame count. Do not overlap two competing speech streams without a deliberate interruption effect. Crossfade only enough to avoid clicks or implausible noise-floor steps; a long dissolve can smear consonants and location changes.

### B-roll decision hierarchy

Use B-roll to:

1. provide evidence or demonstrate the spoken claim;
2. establish place/time/scale;
3. show process, detail, or consequence;
4. reveal character or subtext;
5. bridge time/location or cover a truthful compression;
6. vary the visual field.

Match B-roll semantically and temporally. Prefer `literal evidence → specific relevant illustration → contextual atmosphere → generic filler`. Penalize cliché, repeated imagery, incorrect season/location/object, mismatched direction, and footage whose implied factual status exceeds its provenance.

Cut into B-roll on a word, action, gaze, or sound that motivates it; return when the speaker’s face/reaction adds value. Avoid illustrating every noun literally. Let the shot stay long enough for its intended evidence/action to register. Adobe’s practical capture guidance recommends holding B-roll for roughly a ten-count; for existing footage, the analogous planner rule is to prefer clips with usable pre/post handles.

## 8. Montage, compression, and parallel action

Montage derives meaning from adjacency. The Kuleshov tradition shows that viewers infer emotion and relation from juxtaposition; Eisenstein’s montage makes collision—graphic, rhythmic, tonal, or conceptual—the expressive engine.

### Montage planner

Define:

```text
montage = {purpose, start_state, end_state, motif, progression,
           temporal_model, audio_spine, escalation_curve, payoff}
```

- **Compression montage:** sample milestones sufficient to infer a longer process. Show start, meaningful variation/escalation, and changed result.
- **Metric montage:** organize chiefly by shot length; useful for acceleration/deceleration but can ignore content readability.
- **Rhythmic montage:** cut with movement within shots; align, continue, or collide motion vectors.
- **Tonal/associative montage:** group mood, color, texture, expression, or sound.
- **Intellectual montage:** juxtapose shots to produce metaphor or argument; require a stated intended inference and deception check.
- **Parallel/crosscut:** alternate spatially separate action, often understood as simultaneous. Establish both strands, maintain their individual geography, shorten intervals or raise event intensity toward convergence, and clearly signal if simultaneity is only thematic.

Do not cut on every beat by default. Use musical phrases, syncopation, held shots, internal motion, lyric/meaning, and sound changes. A sequence locked mechanically to a beat often becomes predictable and may sacrifice comprehension. Ensure each shot has enough exposure time to perceive the relevant action/text.

Montage failure modes: no discernible progression; redundant “pretty shots”; false causal/temporal inference; missing final state; music doing all emotional work; cuts too fast to read; constant acceleration with no contrast or release.

## 9. Pacing and rhythm

Pace is the rate of new story information, emotion, action, and sensory change—not simply cuts per minute.

### Measure, but do not worship, these signals

- average and median shot length, plus distribution and local trend;
- cut rate in rolling windows;
- scene/beat duration and information units per minute;
- motion, luminance, audio-energy, and shot-scale curves;
- dialogue rate, pause lengths, and silence density;
- repetition/novelty of subject, composition, and semantic content;
- time from setup/question to payoff;
- retention curve, skips, rewatches, shares, and exits when available.

Research on popular film finds systematic changes in shot duration, motion, luminance, and sound over story progression, and nearby shot lengths can form correlated rather than random patterns. Research also finds edited/fast-paced scenes can feel longer than unedited ones. Therefore use **curves and contrast**, not a fixed “ideal shot length.”

Practical control rules:

- Shorten or intensify toward urgency/climax when story and readability allow; lengthen after payoff for absorption/release.
- Cut when the shot’s new information, emotional change, or useful action is exhausted—not merely because a timer fired.
- Insert a reset (wide shot, silence, held reaction, slower passage) after dense sections so the next acceleration has contrast.
- For suspense, withholding and duration may outperform fast cutting; for comedy, precise setup–turn–reaction timing matters more than raw speed.
- Vary sentence, shot, and scene length. Low variance feels mechanical; unmotivated high variance feels chaotic.
- Text/subtitles impose a readability floor. Do not change shots or captions so rapidly that gaze must repeatedly reacquire content.

No universal cut-rate threshold is defensible across genre, platform, language, or audience. Learn baselines from approved videos of similar format and length; treat deviations as review signals, not automatic errors.

## 10. Hooks and retention for short-form

### Opening design

In the first moments, establish at least two of: subject, stakes/value, novelty, conflict/question, striking action/image, or a credible promised outcome. Start with the strongest truthful moment and backfill only the context required to understand it.

Common hook forms:

- result first, then “how”;
- unresolved question or surprising contradiction;
- action already in progress;
- specific claim with immediate evidence;
- relatable problem followed by a clear promise;
- emotionally charged but context-honest moment.

Adobe’s social guidance suggests roughly two to three seconds to hook a viewer, but this is a platform-style heuristic, not a cognitive law. YouTube’s official analytics defines intro retention for ordinary videos at 30 seconds and recommends moving later “top moments” earlier. The product should expose hook windows as tunable by platform/format and optimize from the creator’s own cohort data.

### Retention loop

1. Ensure title/thumbnail/caption promise matches the opening; a mismatch can cause immediate abandonment.
2. Deliver proof/value early, not only a tease.
3. Remove greetings, logos, throat-clearing, duplicate setup, and requests for engagement unless essential.
4. Maintain “forward pressure” with progress, escalation, unanswered but fair questions, or frequent useful payoffs.
5. Use pattern interrupts—angle, scale, graphic, B-roll, sound, pace—when motivated; constant interruption becomes noise.
6. End soon after the promised payoff or pivot clearly to the next value/action. Consider loopability only when it does not create a deceptive or mutilated ending.

Interpret analytics correctly: YouTube says flat segments indicate sustained viewing; gradual decline is common; spikes may mean rewatch/share **or confusion**; dips may mean skip or exit. Never optimize spikes blindly. Diagnose whether a segment is valuable, unclear, or artificially looped. Compare to videos of similar length and audience.

Recommended experiment metrics: first-1/3/5-second survival where the platform exposes it, 30-second intro retention for applicable YouTube videos, average view duration, percentage viewed/completion, replay rate, skip/exit points, shares/saves, and payoff reach. Optimize a vector of outcomes; completion alone rewards very short or looping content and does not prove satisfaction.

## 11. Multicamera editing

### Synchronize and normalize first

Prefer synchronization evidence in this order when available: verified common timecode/sound timecode; slate/clip marker; audio waveform; distinctive visual/audio event; manual anchor. Adobe supports timecode, in/out, clip marker, and audio-based synchronization. Store sync method, offset, drift estimate, and confidence per clip; never flatten uncertainty.

- Correct sample-rate/frame-rate/timecode interpretation before cutting.
- Detect long-take drift using anchors near both start and end; one good initial waveform match does not guarantee continued sync.
- Group stable camera IDs/labels and preserve source timecode.
- Choose one continuous high-quality dialogue/program audio bed unless switching audio sources is intentional; changing picture angle should not automatically change microphones.
- Exclude unavailable, obstructed, reframing, focus-searching, or operator-adjustment intervals from candidate angles.

### Angle selection

Score active-speaker visibility, listener reaction, composition/quality, shot-scale progression, eyeline/axis, action visibility, novelty, and editorial purpose. Avoid automatic speaker-following: hold a two-shot for interaction, stay on the listener for a meaningful response, use a wide shot to orient or cover overlapping talk, and cut to an insert when the referenced object/action matters.

Cut on meaningful changes—speaker turn, emphasis, reaction, gesture, action, topic/power shift—not every sentence. Penalize very short accidental angle flashes and repetitive A/B metronome patterns. After a real-time first pass, perform a trim/refinement pass; Adobe’s workflow explicitly supports changing angle after the fact and rolling cut timing.

Multicam QC: sync residual in frames/ms; drift over time; bad-angle exposure; jump in color/white balance; axis/eyeline violations; obstructed speaker; cut frequency and angle-transition matrix; audio-source discontinuity; repeated near-identical scale; minimum-shot violations caused by accidental keypress/cut.

## 12. End-to-end planner workflow

1. **Ingest and preserve:** hash originals; collect rights/restrictions; normalize metadata without overwriting source.
2. **Analyze:** transcribe, diarize, detect shots/scenes/faces/actions/gaze/motion/quality/audio, retain confidence and unknowns.
3. **Learn the brief:** audience, duration, platform, factual stakes, story goal, tone, pace, continuity/discontinuity tolerance, required/forbidden elements.
4. **Build story graph:** beats, prerequisites, causal links, open loops, evidence, emotional changes, possible hooks/payoffs.
5. **Radio/assembly cut:** choose truthful performance and structural order before polishing visuals.
6. **Coverage plan:** map every interval to speaker, reaction, action, B-roll, archival, graphics, or intentional hold.
7. **Optimize sequence:** beam search/dynamic programming over candidate shots and edit operations with local and global objectives.
8. **Audio pass:** intelligibility, breaths, room tone, J/L cuts, ambience, music/SFX hierarchy.
9. **Continuity/truth pass:** geometry, action, chronology, semantic context, provenance, representation, rights.
10. **Pace/retention pass:** trim redundancy, shape intensity, verify hook promise and payoff, preserve breathing room.
11. **QC and alternatives:** generate violation report and at least one alternate for low-confidence/high-impact decisions.
12. **Human review and export:** source-linked transcript/EDL, rationale, warnings, version history, undoable operations.

## 13. Failure-mode checklist

- **Technically smooth, narratively empty:** every cut scores visual continuity but no beat changes.
- **Overcutting:** cuts substitute for weak material, destroy performance, or prevent image/text comprehension.
- **Undercutting:** redundant pauses/setup remain without tension, emotion, or useful information.
- **Talking-head wallpaper:** generic B-roll loosely matches nouns but contributes no evidence, place, character, or progression.
- **Ping-pong dialogue/multicam:** camera follows speaker turns mechanically and misses reactions/subtext.
- **Accidental jump/axis break:** insufficient angle/scale change or reversed screen direction without reorientation.
- **False documentary meaning:** reordered phrases, substituted silence/reaction, illustrative footage presented as evidence, or unmarked chronology change.
- **Audio seam:** clipped breath/phoneme, room-tone jump, doubled word, reverberation cutoff, music masking speech.
- **Retention cargo cult:** arbitrary cut every N seconds, incessant zoom/caption/SFX, clickbait opening, or withholding payoff.
- **Montage without arc:** shots share a look but do not progress, contrast, transform, or conclude.
- **AI legibility bias:** clean, obvious material crowds out subtle/uncertain footage or marginalized speakers.
- **Local optimum:** individually strong bites repeat one another or consume setup needed for the ending.
- **No handles:** chosen source region cannot support a breath, transition, reaction, or trim.
- **Style leakage:** short-form hyperactivity applied to testimony, grief, instruction, or complex evidence where time is needed.

## 14. Product defaults worth implementing

These are proposed, tunable safety defaults—not universal editing laws:

- Require a reason tag for every cut and every deliberate continuity violation.
- Provide profiles (`classical`, `documentary`, `dialogue`, `energetic-short`, `montage`, `multicam`) as weight sets, never opaque magic modes.
- Keep audio and video edit points independently editable.
- Let users lock exact words, source intervals, chronology, people, beats, audio bed, and camera angles before regeneration.
- Visualize story beats, open loops, source provenance, confidence, continuity flags, and retention evidence directly on the timeline.
- For transcript edits, show removed context and semantic-difference warnings; protect negation, attribution, numbers, names, and qualifiers.
- Route sensitive documentary transformations and low-confidence sync/identity decisions to review.
- Evaluate edits at three scales: seam/cut, scene/beat, and complete story. Passing cut-level QC is not evidence that the video works.

## Sources

All sources accessed 2026-07-25.

- [Oklahoma State University Open Textbook — Editing: continuity, parallel editing, discontinuity, rhythmic editing, Kuleshov effect](https://open.library.okstate.edu/introfilmtv/part/editing/)
- [Film Education — A guide to key filmic terms](https://www.filmeducation.org/pdf/resources/secondary/Sequence_Analysis_key_terms.pdf)
- [BBC Academy — Preparing for the Edit](https://downloads.bbc.co.uk/academy/collegeofproduction/docs/preparing_for_the_edit_ts.pdf)
- [BBC Academy — How to edit a documentary (transcript)](https://downloads.bbc.co.uk/academy/academyfiles/080617%20How%20to%20edit%20a%20documentary%20%28Transcript%29.pdf)
- [BBC Academy — Interviewing: Getting the shot right](https://downloads.bbc.co.uk/academy/academyfiles/TVNewsInterviewing/Interviewing%20-%20Getting%20the%20shot%20right.pdf)
- [International Documentary Association — Before the First Cut: When AI Decides What We Edit](https://www.documentary.org/column/synthesis-first-cut-when-ai-decides-what-we-edit)
- [International Documentary Association — Beyond the Talking Head](https://www.documentary.org/feature/beyond-talking-head-step-step-guide-shooting-documentary-interviews)
- [International Documentary Association — Common Legal Issues for Documentary Filmmakers](https://documentary.org/column/beyond-vetting-common-legal-issues-documentary-filmmakers)
- [International Documentary Association — The Relationship between Filmmaker and Subject](https://www.documentary.org/feature/question-ethics-relationship-between-filmmaker-and-subject)
- [PBS — The making of *Legacy*: structure discovered in editing](https://www.pbs.org/legacy/documentary/making.html)
- [Adobe — Introduction to video editing, Murch’s Rule of Six, workflow, pacing, and social hooks](https://www.adobe.com/creativecloud/video/discover/edit-a-video.html)
- [Adobe — Create J- and L-cuts in Premiere Pro](https://helpx.adobe.com/premiere/desktop/edit-projects/trim-clips/perform-j-cuts-and-l-cuts.html)
- [Adobe — B-roll: purpose, planning, and usable shot length](https://www.adobe.com/creativecloud/video/discover/b-roll.html)
- [Adobe — Shot/reverse shot and dialogue coverage](https://www.adobe.com/creativecloud/video/production/cinematography/camera-shots-and-angles/reverse-shot.html)
- [Adobe — Foundational shots, cutaways, reactions, sequencing, and rhythm](https://www.adobe.com/uk/creativecloud/video/production/cinematography/camera-shots-and-angles.html)
- [Adobe — Create multicamera source sequences and synchronization methods](https://helpx.adobe.com/sg/premiere/desktop/edit-projects/set-up-multi-camera-sequences-for-editing/create-a-multi-camera-source-sequence.html)
- [Adobe — Create and refine a multicamera target sequence](https://helpx.adobe.com/be_nl/premiere/desktop/edit-projects/set-up-multi-camera-sequences-for-editing/create-and-edit-a-multi-camera-target-sequence.html)
- [YouTube Help — Key moments for audience retention](https://support.google.com/youtube/answer/9314415?hl=en-GB)
- [YouTube Help — Shorts analytics tips](https://support.google.com/youtube/answer/12942217?co=YOUTUBE._YTVideoType%3Dshorts&hl=en-GB)
- [Magliano & Zacks — The Impact of Continuity Editing in Narrative Film on Event Segmentation](https://pmc.ncbi.nlm.nih.gov/articles/PMC3208769/)
- [Moneglia et al. — Movie editing influences spectators’ time perception](https://pmc.ncbi.nlm.nih.gov/articles/PMC9684412/)
- [Cinematic continuity edits across shot scales and camera angles: an ERP analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC10375706/)
- [Cutting, DeLong & Nothelfer — Attention and the Evolution of Hollywood Film](https://doi.org/10.1177/0956797610361679)
- [Cutting — The evolution of pace in popular movies](https://doi.org/10.1186/s41235-016-0029-0)
- [Encyclopedia of Film — Editing and Soviet montage](https://www.encyclopedia.com/arts/encyclopedias-almanacs-transcripts-and-maps/editing)
- [Library of Congress-hosted *Montage Culture* — Kuleshov and Soviet montage theories](https://tile.loc.gov/storage-services/master/gdc/gdcebookspublic/20/21/75/84/90/2021758490/2021758490.pdf)
- [Learning to Cut by Watching Movies — computational cut plausibility research](https://arxiv.org/abs/2108.04294)
- [MovieCuts — dataset and benchmark for cut-type recognition](https://arxiv.org/abs/2109.05569)

