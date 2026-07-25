# Effects editorial methodology

**Scope:** editorial rules for selecting, timing, budgeting, previewing, and validating visual and audio effects. This note is deliberately renderer-neutral. It describes what an effects planner should mean and protect before a browser renderer, FFmpeg graph, shader, plug-in, or export adapter implements the effect.

## 1. Core position: an effect is an editorial claim

An effect is not inherently impactful. It becomes impactful when it changes attention, time, space, emphasis, or feeling at the exact moment the story needs that change. The same zoom that makes a reveal legible can make testimony feel manipulative; the same impact sound that gives an action weight can cheapen a quiet admission.

Require every expressive effect to answer:

1. **What story beat motivates it?** Point to a reveal, action, reversal, emotional turn, structural boundary, or required visual detail.
2. **What should the viewer perceive or feel?** Direct attention, compress time, suspend time, feel impact, recognize a section change, share a character's instability, or read information.
3. **Why is the clean edit insufficient?** If a cut, hold, performance, or natural sound already does the job, the effect may only add noise.
4. **What does it cost?** Account for occlusion, motion, flash, reading interference, audio headroom, render risk, and cumulative novelty.
5. **What is the lower-intensity fallback?** An effect with no graceful degradation is unsafe for automatic application.

This can be represented as a motivated-effect contract:

```ts
interface EffectIntent {
  effectId: string;
  targetIds: string[];
  range: TimeRange;
  motivation:
    | "direct_attention" | "compress_time" | "expand_time"
    | "reinforce_impact" | "bridge_discontinuity"
    | "mark_structure" | "express_subjectivity"
    | "improve_legibility" | "protect_identity";
  evidenceIds: string[];             // beat, word, action, face, object, cut, music event
  anchor: "onset" | "apex" | "release" | "whole_beat";
  intendedViewerEffect: string;
  comprehensionRisk: "low" | "medium" | "high";
  attentionCost: number;
  safetyClasses: string[];           // flash, large_motion, generated_frames, transient, etc.
  prerequisites: string[];
  fallbackEffectId: string | "clean";
  reviewPolicy: "automatic" | "preview_required" | "approval_required";
}
```

Corrective processing is different. Level matching, color normalization, stabilization, denoise, de-clicking, and a readable reframe may be needed to make sources coherent. They should still be declared and reversible, but they do not need a dramatic beat. The system must not hide an expressive manipulation under a `corrective` label.

## 2. Editorial priority and selection rule

When effects conflict with other goals, use this order:

1. factual and source integrity;
2. intelligible speech, required evidence, and accessible text;
3. emotional truth and story progression;
4. rhythm and attention guidance;
5. stylistic polish and novelty.

This follows the project's broader principle that effects support the edit rather than substitute for it. Empirical television research found that related and unrelated cuts affect attention and memory differently, and that a viewer must process the relationship introduced by an edit; salience alone is not equivalent to comprehension [Lang et al., 1993](https://doi.org/10.1177/009365093020001001). Research that selectively added sound effects and visual inserts found they could guide attention to significant story information, but the relevant lesson for a planner is **selective and significant**, not “add more” [Calvert and Gersh, 1987](https://files.eric.ed.gov/fulltext/ED274430.pdf).

Use this decision test:

```text
candidate effect
  -> does it have a verified motivation and target?
  -> does it preserve meaning, evidence, speech, and required regions?
  -> is it compatible with the beat's role and neighboring effects?
  -> is it within attention, safety, and technical budgets?
  -> does a supported renderer implement it faithfully?
  -> can it be previewed and reversed?
  -> apply as a proposal; otherwise substitute or stay clean
```

“Stay clean” is a successful outcome, not a generation failure. Proof, testimony, grief, apology, precise instruction, and difficult dialogue often become more forceful when the platform resists decorative motion.

## 3. Motivation taxonomy

### 3.1 Direct attention

Use a restrained push-in, crop change, highlight, defocus, contrast change, or audio focus to guide the eye or ear toward information already present. The effect must identify a verified subject or region. Never highlight an object merely because it is visually prominent if it is not relevant to the beat.

Good uses:

- move from context to the speaker's reaction at the emotional turn;
- make a product control, graph value, or physical detail readable;
- lower background salience while a title or disclosure is read;
- duck music when the decisive phrase begins.

Bad uses:

- continuous face zooms on every sentence;
- blur that removes evidence needed to evaluate a claim;
- an animated pointer whose motion competes with the demonstrated action;
- enlarging already large captions while the underlying face is speaking.

### 3.2 Compress or expand perceived time

Speed-ups compress low-information duration: travel, repetitive setup, waiting, or a process whose intermediate states are unnecessary. Slow motion expands a decisive action, expression, reveal, or visual process whose detail matters. A ramp can connect normal-speed context to a time-compressed or time-expanded center.

Time manipulation changes more than duration. It changes physical weight, performance timing, speech, ambience, causality, and sometimes credibility. Protect semantic landmarks such as word boundaries, contact points, a look, a button press, or an object landing. Do not accelerate required reading or silently alter the cadence of sensitive testimony.

For a rate curve `r(t) > 0`, output duration is the integral of source time divided by rate. The compiler should solve this exactly enough to preserve the selected source endpoint and composition anchor. A usable ramp has explicit source and composition anchors, bounded rate, a declared interpolation method, and continuity at its joins. It must never be represented only as “make this faster.”

Adobe distinguishes frame sampling, frame blending, and optical flow: sampling repeats or removes original frames, blending combines neighbors, and optical flow synthesizes intermediate motion [Adobe time interpolation documentation](https://helpx.adobe.com/ca/premiere/desktop/edit-projects/change-clip-speed/apply-time-interpolation-methods-to-adjust-clip-speed.html). Each failure looks different. Sampling can judder, blending can ghost, and optical flow can tear or invent implausible shapes at occlusions, cuts, fine detail, flashes, or crossing motion. Generated-frame slow motion therefore requires final-resolution review and an original-frame fallback.

Audio policy for speed effects must be explicit:

- keep dialogue at normal speed unless altered speech is the actual intent;
- if picture rate changes under normal dialogue, split or independently map audio;
- if source audio changes speed, declare whether pitch follows rate, is preserved, or is muted/replaced;
- rebuild ambience across compressed passages rather than leaving rhythmic gaps;
- do not conceal a synthetic performance change as ordinary cleanup.

### 3.3 Reinforce a physical or rhetorical impact

An impact may combine a scale impulse, one directional displacement, contrast or exposure accent, very short blur, transient sound, music hit, or momentary silence. The parts should share one causal event. The useful shape is usually:

```text
anticipation -> event apex -> decay -> clean recovery
```

The effect should peak at a verified impact frame or rhetorical word, not at an arbitrary music-grid position. The anticipation may lead the event slightly, while the transient and visual apex align closely enough to feel causal. Recovery matters: if the frame keeps shaking and the sound keeps ringing, the next idea cannot establish a new hierarchy.

Stacking five accents does not necessarily create five times the impact. Motion, flash, scale, bass, and an impact sound often compete after the first clear cue. Prefer the smallest combination that communicates the event.

### 3.4 Bridge or deliberately expose a discontinuity

A dissolve, blur, whip, light change, sound bridge, match, or transition can connect time, place, graphic shape, movement, or emotion. A transition should declare the relationship it communicates:

- **continuity:** time/place are perceived as connected;
- **passage:** time has advanced or state has changed;
- **comparison:** two things share a relevant form or idea;
- **contrast:** a hard tonal or informational reversal;
- **subjective shift:** memory, dream, instability, or point of view;
- **chapter boundary:** a new section with a new question.

If it communicates none of these, use a cut. Never stack competing primary transitions on one boundary. A whip needs directional motion and sufficient source handles; a match needs verified visual or semantic correspondence; a dissolve needs a meaningful overlap. Fallback order is generally simpler presentation, shorter presentation, hard cut plus audio bridge, then clean cut.

### 3.5 Mark structure or state

Titles, lower thirds, recurring color roles, chapter cards, audio motifs, or stable layout changes can teach the viewer a vocabulary: problem versus solution, before versus after, source versus commentary, instruction versus result. Repetition is valuable when it creates recognition. Keep the motif stable enough to be learned; changing type animation, colors, and sound on every recurrence defeats the structural purpose.

### 3.6 Express subjectivity or mood

Shake, focus loss, vignetting, color bias, distortion, echo, muffling, and abnormal time can put the viewer inside a character's perception. These are high-semantic effects: they imply anxiety, memory, intoxication, danger, nostalgia, surveillance, or unreliability. Require stronger evidence and usually approval because an automatic system can impose a tone the source does not support.

### 3.7 Improve legibility or protect identity

Background blur, mattes, contrast plates, repositioning, and audio separation can make text or dialogue accessible. Face, plate, screen, or document obscuration can protect privacy, but an aesthetic blur is not by itself a privacy guarantee. The protected region must remain covered for every rendered frame, including transitions, motion blur, alternate aspect ratios, and thumbnails. High-risk redaction needs a dedicated policy and human verification.

## 4. Effect-family playbook

| Family | Valid motivation | Preconditions | Common harm | Lower-risk fallback |
|---|---|---|---|---|
| Constant speed / speed ramp | compress process, expand action, land on a beat | source FPS/timestamps, protected landmarks, rate and audio policy | judder, ghosting, warped limbs, changed speech, A/V drift | hard time cut, montage, original-frame sampling |
| Digital push / punch-in | direct attention, create shot-scale change, emphasize reaction | verified region, source resolution, crop handles | resolution loss, cut-off hands/text, manipulative emphasis, repetitive “breathing” | static crop or clean hold |
| Shake / scale impulse | impact, instability, subjective shock | causal event, crop overscan, motion budget | nausea, illegibility, black edges, false energy | one small scale/contrast impulse or SFX only |
| Blur / defocus | hierarchy, transition, privacy, subjective state | mask/region confidence, compositing order, temporal tracking | lost evidence, halo, caption blur, failed redaction | contrast plate, dim background, cut |
| Color normalization | source continuity and correct display | correct input tags and working/output spaces | clipped gamut, mismatched shots, damaged skin/brand color | neutral transform and review |
| Creative grade / tint | mood, structure, temporal distinction | normalized sources, declared look role, accessible graphics composited appropriately | false time/place cue, crushed detail, skin bias, low text contrast | lower-intensity look or normalized image |
| Flash / glow / glitch / RGB split | rupture, technological motif, impact | flash analysis, style permission, recovery interval | seizure risk, visual discomfort, illegible evidence, cliché | single non-flashing contrast change, cut, sound accent |
| Dissolve / wipe / whip | passage, relation, direction, chapter boundary | adjacent handles, boundary ownership, semantic relation | mushy timing, duration drift, invented motion, transition soup | audio bridge plus cut |
| Caption animation | speech tracking, active-word emphasis, hierarchy | word alignment, reading time, safe region, contrast | reading becomes a reaction test, face obstruction, constant motion | static phrase cues |
| Impact SFX / whoosh | physical cause, transition path, rhetorical accent | licensed asset, semantic match, audio headroom | false physical scale, transient clipping, repetitive template feel | quieter/shorter accent or natural sound |
| Riser / downer / music drop | anticipation, release, boundary, reveal | known apex, music rights, dialogue-aware mix | telegraphed reveal, emotional coercion, masked speech | automation-only duck or silence |
| EQ / denoise / compression | intelligibility and continuity | noise sample or measured signal, monitoring, reversible settings | pumping, lisping, phase artifact, flattened performance | lighter cleanup and room-tone patch |

Color effects require an explicit color pipeline. Adobe's current color-management documentation describes converting sources into a sequence working space, applying effects there, and converting to an output space; it also warns that changing the working space after effects are applied can change their appearance [Adobe color-management documentation](https://helpx.adobe.com/premiere/desktop/correct-color/set-up-color-management/how-color-management-works.html). Store input interpretation, working space, effect space, and output transform separately. Do not let a LUT name stand in for color management.

## 5. Rhythm: accent, release, and hierarchy

Rhythm is not “put an effect on every beat.” It is the relationship among information density, performance, shot duration, motion, speech cadence, music, sound, and silence.

### 5.1 Anchor effects to editorial events

Rank possible anchors:

1. story or emotional turn;
2. visible action onset/contact/release;
3. decisive word or phrase;
4. shot or section boundary;
5. music beat or bar;
6. an arbitrary time grid.

Music can refine timing after meaning is protected. If snapping an important cut or word to the nearest beat makes the performance late or clips a thought, keep the performance. Store the proposed snap delta and reject it above the beat-specific tolerance.

### 5.2 Use density curves, not uniform density

A sequence benefits from contrast:

- **hook:** may spend attention quickly, but must make a truthful promise;
- **orientation/explanation:** reduce decoration so the viewer can build a mental model;
- **evidence/testimony:** reserve the frame and mix for proof;
- **escalation/montage:** increase cut, motion, and sound density coherently;
- **turn/reveal:** one distinctive accent can reset attention;
- **payoff/CTA:** simplify hierarchy so the requested takeaway is unmistakable.

Repeated effects need recovery intervals. A punch-in on every sentence ceases to be punctuation. A whoosh on every movement turns causal sound into wallpaper. A music hit on every cut removes the difference between setup and payoff.

### 5.3 Establish and spend a motif

Prefer two or three reusable expressive motifs per short asset over a new effect at every opportunity. For example:

- a restrained push for evidence;
- a single impact vocabulary for reversals;
- one stable title/caption motion system.

Reuse makes the style coherent; variation should come from source content and beat strength. Reserve the strongest amplitude, duration, contrast, or sound for the strongest beat.

## 6. Effect budgets

An effects budget is both an editorial hierarchy and a safety mechanism. It must operate in rolling windows and at individual boundaries, not only count effects over the entire video.

### 6.1 Budget dimensions

Track at least:

```ts
interface EditorialEffectBudget {
  rollingWindowSeconds: number;
  attentionUnits: number;
  simultaneousSalientVisuals: number;
  simultaneousPrimaryMotions: number;
  primaryTransitionsPerBoundary: number;
  uniqueExpressiveMotifs: number;
  fullFrameEffectSeconds: number;
  captionOcclusionRatio: number;
  largeMotionSeconds: number;
  flashEvents: number;
  generatedFrameRatio: number;
  impactTransients: number;
  dialogueMaskingSeconds: number;
  minCleanRecoverySeconds: number;
  minReuseIntervalByMotif: Record<string, number>;
}
```

Compute attention cost from more than count. Useful factors include affected screen area, motion displacement and velocity, luminance/color contrast, duration, novelty, audio transient strength, text occlusion, and simultaneous salient layers. Costs should increase nonlinearly when multiple full-frame effects coincide.

### 6.2 Conservative P0 defaults

These are tunable product defaults, not universal film rules:

- one primary transition per boundary;
- one dominant motion at a time unless a composite recipe was designed and tested as a unit;
- no decorative animation while a dense disclosure, proof point, or unfamiliar proper noun must be read;
- one clean recovery interval after a major full-frame accent;
- no repeated use of the same accent on adjacent minor beats;
- captions, faces, evidence, and brand/disclosure regions have hard priority over decoration;
- generated-frame effects always consume a technical-risk budget and require final-render review;
- flash thresholds are hard safety constraints, not a style budget that can be “spent.”

When over budget, remove duplicate decoration first, reduce intensity or area second, substitute a simpler cut/audio bridge third, and preserve the effect attached to the most important verified beat. Never regain budget by shortening required reading time or clipping speech.

### 6.3 Clean variants are the control group

Every effectful proposal should be comparable to a clean or minimal variant aligned to the same source edit. The diff should name effects, parameter changes, attention cost, duration change, safety flags, and rationale. This lets an editor judge whether the effect genuinely improves the beat instead of comparing two unrelated cuts.

## 7. Accessibility and motion safety

### 7.1 Flash and rapidly changing imagery

WCAG 2.2 Success Criterion 2.3.1 requires content to stay at no more than three flashes in a one-second period or below defined general/red-flash area and luminance thresholds [WCAG 2.2](https://www.w3.org/TR/WCAG22/#three-flashes-or-below-threshold). “Three per second” alone is not a complete certification because area, luminance change, and saturated red matter. Ofcom's broadcast guidance likewise treats flashing images and regular patterns as potentially harmful to viewers with photosensitive epilepsy [Ofcom flashing-images guidance](https://www.ofcom.org.uk/siteassets/resources/documents/tv-radio-and-on-demand/broadcast-guidance/gn_flash.pdf?v=324195).

The platform should:

- automatically analyze the complete rendered sequence, including interactions among edits, overlays, and source footage;
- treat a failed or unavailable analysis as blocking for flash/glitch/strobe recipes;
- provide a non-flashing substitute;
- never assume individually safe effects remain safe when composited;
- preserve the analyzer version, profile, and result with the render.

### 7.2 Large and continuous motion

Fast full-frame translation, high-frequency shake, simulated camera motion, motion in peripheral regions, and repeated zooming can cause discomfort. Apple's motion guidance is written for interfaces, not authored video, but its general design principles are useful: motion should have a purpose, avoid overshadowing the experience, and have an optional/lower-motion path because excessive motion can distract or cause physical discomfort [Apple Human Interface Guidelines: Motion](https://developer.apple.com/design/human-interface-guidelines/motion).

Provide a `reduced_motion` render/profile with declared substitutions:

| Original | Reduced-motion substitute |
|---|---|
| whip or large slide | cut, short dissolve, or audio bridge |
| camera shake | small non-oscillating scale/contrast impulse or sound only |
| strobe / repeated flash | one bounded non-flashing luminance or color change |
| continuously bouncing captions | static phrase cue or one opacity reveal |
| parallax / drifting background | stable composition |
| rapid zoom sequence | static shot-scale changes at cuts |

A substitute still needs flash, contrast, and comprehension checks. Reduced motion is not a blanket accessibility certification.

### 7.3 Captions and effects

WCAG defines captions as synchronized alternatives for speech and meaningful non-speech audio, and notes that captions should not obscure relevant information [W3C captions guidance](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded). Consequently:

- caption impact sounds, alarms, music changes, and offscreen voices when they are needed to understand the effect;
- do not apply the creative picture blur, shake, distortion, or grade to the primary caption lane unless the requested style has a separately validated accessible caption presentation;
- preserve cue reading time when time-remapping picture;
- keep active-word animation subordinate to reading, not a second rhythm game;
- collision-test captions against faces, speaker IDs, lower thirds, disclosures, and destination UI for every frame;
- ensure text remains distinguishable from changing backgrounds. W3C's distinguishability guidance explicitly treats both visual foreground/background contrast and audio foreground/background separation as accessibility concerns [W3C Guideline 1.4](https://www.w3.org/WAI/WCAG22/Understanding/distinguishable.html).

Netflix's public timed-text guidance is a useful delivery profile, not a universal rule: its general requirements specify no more than two lines and event duration bounds, while its timing guidance stresses audio/image sync, comfortable timing within edits, and full watch-back to correct flashy timing [Netflix general requirements](https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements), [Netflix subtitle timing guidelines](https://partnerhelp.netflixstudios.com/hc/en-us/articles/360051554394-Timed-Text-Style-Guide-Subtitle-Timing-Guidelines). Store such limits in named destination/language profiles rather than hard-coding one global caption behavior.

### 7.4 Safe areas are destination data

Do not use a permanent “10 percent safe” rectangle. Mobile players place controls, captions, account names, buttons, and crop behavior asymmetrically. YouTube's Shorts editor warns when an overlay approaches a non-safe area [YouTube Shorts enhancement guidance](https://support.google.com/youtube/answer/16215842?hl=en-GBTap), and Meta explicitly recommends keeping key Reels messages in its safe zone [Meta Reels guidance](https://www.facebook.com/business/ads/facebook-instagram-reels-ads).

Represent safe areas as versioned polygons by platform, surface, aspect ratio, locale, device class, and date. Preview the actual UI overlay when possible. Captions and titles need a conservative fallback profile when current platform data are unavailable.

### 7.5 Audio foreground and transient safety

Dialogue, narration, and meaningful natural sound remain the foreground. Duck music and SFX from the detected dialogue envelope with bounded attack/release, then listen for pumping and clipped word onsets. Do not solve masking solely by making the complete mix louder.

Loudness targets belong to delivery profiles. EBU R 128 recommends programme loudness normalization, Loudness Range, and maximum true-peak descriptors for its broadcast context [EBU R 128](https://tech.ebu.ch/publications/r128). It is not a universal social-video target. Each destination profile should declare integrated/short-term policy, true-peak ceiling, channel layout, dialogue priority, and measurement standard/version.

## 8. Preview and review workflow

Effects cannot be approved from parameter values or a still thumbnail. Preview must preserve context, timing, compositing, sound, and the destination crop.

### 8.1 Preview modes

Provide:

1. **clean/effect A-B:** same source edit and timing, effect bypassed versus applied;
2. **context preview:** enough material before and after to judge anticipation, apex, decay, and recovery;
3. **effect solo:** selected effect or bus isolated to diagnose stacking;
4. **motion-safe preview:** reduced-motion substitution rendered beside the default;
5. **caption/safe-zone overlay:** caption boxes, essential regions, crop bounds, and destination UI exclusions;
6. **audio views:** full mix, dialogue-only, music/SFX-only, and loudness/true-peak meters;
7. **quality tiers:** responsive proxy for iteration and full-resolution/full-frame-rate render for approval;
8. **target-device preview:** actual aspect, pixel density, typical display size, and representative speakers/headphones.

The approval preview must use the same effect graph, time mapping, color pipeline, and mix rules as export. A proxy can omit expensive interpolation during editing only if it is visibly labeled and approval is blocked until the final implementation is reviewed.

### 8.2 Human review passes

Separate the questions so one dazzling accent does not hide a story problem:

- **story pass:** is the clean edit truthful, understandable, and emotionally coherent?
- **motivation pass:** can every expressive effect be explained at its exact beat?
- **rhythm pass:** are there hierarchy, contrast, and clean recovery rather than uniform stimulation?
- **accessibility pass:** inspect captions, safe areas, reduced-motion alternative, flash result, color distinction, and dialogue masking;
- **artifact pass:** inspect speed changes, masks, crop edges, tracking, transition handles, compositing, noise, peaks, and sync;
- **destination pass:** watch the complete encoded artifact on representative devices with platform UI.

Review the complete video at normal speed at least once. Frame stepping is for diagnosis; it cannot judge rhythm or comfort.

## 9. Automated and rendered QC

Validate the **rendered pixels and samples**, not just the intended timeline. EBU's QC model distinguishes wrapper, bitstream, decoded baseband, cross-check, and programme-layout tests, which is a useful architecture for an effects platform [EBU QC Editor Guidelines](https://tech.ebu.ch/docs/qc/public/QC_editor_guidelines_v20161211.pdf).

### 9.1 Universal checks

- complete decode succeeds; output duration, frame/sample count, and timestamps match the proposal;
- no missing, black, frozen, single-frame, duplicated, or corrupted frames except declared effects;
- source-to-composition mappings remain monotonic unless reverse playback was explicit;
- linked A/V remains within the profile's sync tolerance;
- no effect begins or ends outside its target or available media handles;
- flash analysis passes on the complete composite;
- captions have valid order/duration, remain inside the active safe profile, and avoid required regions;
- dialogue is intelligible; no unintended silence, clipping, transient overs, or delivery loudness failure;
- color tags, working/output transforms, gamut, and range agree with decoded pixels;
- every unsupported or degraded effect appears in the compatibility report;
- approval hash corresponds to the exact rendered graph and media revision.

### 9.2 Family-specific checks

**Speed and interpolation**

- verify rate bounds, ramp continuity, exact endpoints, duration, and audio policy;
- reset interpolation across real cuts and flashes;
- inspect hands, faces, text, grids, occlusions, crossing objects, and high-frequency texture for warping or ghosting;
- report generated-frame proportion and retain an original-frame alternative.

**Transform, zoom, stabilization, and shake**

- evaluate required-region coverage on rendered frames;
- check crop overscan/black edges, effective source resolution, headroom, and motion velocity/acceleration;
- flag detector-driven micro-jitter and abrupt path changes at shot boundaries;
- collision-test transformed footage with captions and graphics.

**Blur, mask, and redaction**

- evaluate mask coverage, edge softness, temporal tracking loss, transition frames, and alternate crops;
- composite captions and essential graphics in their intended unblurred layer;
- block privacy approval when any protected frame/thumbnail is uncovered.

**Color and light**

- run scopes/gamut checks after the creative effect and output transform;
- sample caption contrast over time, not only on the first frame;
- inspect skin, neutral objects, brand colors, gradients, and saturated highlights;
- distinguish intentional flashes from illegal or accidental flash sequences.

**Audio effects**

- measure integrated and short-term loudness, true peak, clipping, DC/phase issues where applicable, and dialogue-to-background relationship under the destination profile;
- inspect denoise artifacts, aggressive compression/pumping, reverb tails cut at boundaries, and repeated identical SFX;
- verify transient timing against the causal picture event and caption meaningful non-speech sound.

### 9.3 Diagnostics must be actionable

Bad: `effect failed`.

Good:

```text
FX_SPEED_014 optical-flow review required
effect: fx_speed_ramp_03
range: composition 00:12:14-00:13:08
evidence: high occlusion around tracked hand at frames 382-391
fallback: frame_sampling or clean montage cut
preview: render/fx_speed_ramp_03_review.mp4
```

Warnings need effect ID, exact range, failed rule, observed versus allowed value, affected evidence/caption/region, suggested substitute, and preview link. A warning that cannot help a person decide is merely telemetry.

## 10. Planner policy and implementation order

### 10.1 Selection score

Effects can be ranked with a constrained score, but hard constraints must remain gates:

```text
score = motivationFit
      + beatImportance * emphasisGain
      + styleFit
      + rhythmFit
      + learnedUserPreference
      - comprehensionCost
      - accessibilityRisk
      - attentionBudgetCost
      - technicalArtifactRisk
      - repetitionPenalty
```

Do not let a high style score compensate for a flash failure, missing media handle, unreadable caption, unsupported renderer, or obscured evidence.

### 10.2 P0 effect catalog

Implement in risk order:

1. **Foundational corrective controls:** opacity, transform/crop with required-region constraints, gain/fades/ducking, basic normalization and color pipeline, caption-safe compositing.
2. **Low-risk expressive controls:** bounded static/digital push, short opacity/blur/contrast accents, simple dissolves, stable title motion, licensed SFX with headroom rules.
3. **Time controls:** constant rate, explicit audio policy, original-frame interpolation; then bounded ramps.
4. **Composite recipes:** impact, chapter transition, comparison layout, subject focus—each with prerequisites, budget cost, and fallback.
5. **Higher-risk effects:** shake, whip, glitch, flash, generated-frame slow motion, tracked redaction, subjective distortion. Require specialized QC and stronger approval.

This order lets the platform build impact from timing, hierarchy, intelligibility, and coherent motifs before chasing spectacular rendering.

### 10.3 Acceptance criteria for an effects proposal

An effect proposal is ready to apply only when:

- every expressive effect names a verified motivation and evidence anchor;
- time, transform, audio, color, and layer semantics are typed rather than stored as opaque strings;
- effect costs fit global, rolling-window, beat, boundary, and safety budgets;
- captions, evidence, faces, disclosures, and safe areas remain protected;
- a clean or lower-risk fallback exists;
- the compiler can lower it to the active renderer without silent loss;
- deterministic simulation passes before timeline mutation;
- the same graph used for preview is used for export;
- rendered-pixel/sample QC passes, including flash and destination profile checks;
- high-risk effects receive the declared human approval;
- effect lineage, parameters, analyzer versions, diagnostics, and approval are attached to the immutable revision.

## 11. Product takeaway

The platform should not expose “more effects” as its main intelligence. Its advantage should be **motivated effects with restraint**: it knows the story beat, chooses the smallest effective intervention, makes the cost visible, offers a clean comparison, and can prove the result remains readable, comfortable, technically sound, and reversible.

The best automatic effect is often a subtle one at the right frame. The second-best is a system confident enough to leave the moment alone.
