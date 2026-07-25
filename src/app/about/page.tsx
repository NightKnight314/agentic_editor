import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import sketchPipeline from "../../../images/Screenshot_20260725_000714_Samsung_Notes.webp";
import sketchPatterns from "../../../images/Screenshot_20260725_000717_Samsung_Notes.webp";
import sketchLayers from "../../../images/Screenshot_20260725_000720_Samsung_Notes.webp";
import sketchFeedback from "../../../images/Screenshot_20260725_000725_Samsung_Notes.webp";

export const metadata: Metadata = {
  title: "How Nightcut Works",
  description: "From four hackathon sketches to an evidence-grounded, agent-driven video editing system."
};

const stages = [
  {
    number: "01",
    eyebrow: "Observe",
    title: "Source media",
    description: "Video, audio, images, transcript words, frames, and immutable asset facts.",
    tags: ["source time", "provenance"],
    accent: "red"
  },
  {
    number: "02",
    eyebrow: "Understand",
    title: "Evidence catalog",
    description: "Multimodal observations become bounded events—not premature edit decisions.",
    tags: ["events", "confidence"],
    accent: "amber"
  },
  {
    number: "03",
    eyebrow: "Author",
    title: "EditScript",
    description: "A model or editor describes beats, selectors, recipes, constraints, and fallbacks.",
    tags: ["intent", "style map"],
    accent: "violet"
  },
  {
    number: "04",
    eyebrow: "Compile",
    title: "Proposal",
    description: "Deterministic code binds exact evidence, evaluates effects, and simulates operations.",
    tags: ["diff", "diagnostics"],
    accent: "blue"
  },
  {
    number: "05",
    eyebrow: "Decide",
    title: "Revision",
    description: "A human previews and approves. Apply creates an immutable, reversible timeline revision.",
    tags: ["approval", "revert"],
    accent: "green"
  },
  {
    number: "06",
    eyebrow: "Deliver",
    title: "Render + QC",
    description: "One render plan drives export, effect fidelity, loudness, captions, and final checks.",
    tags: ["FFmpeg", "lineage"],
    accent: "cyan"
  }
] as const;

const sketches: Array<{
  image: StaticImageData;
  number: string;
  title: string;
  description: string;
  alt: string;
}> = [
  {
    image: sketchPipeline,
    number: "01",
    title: "The first loop",
    description: "Source dump → multimodal analysis → script → timeline events → builder → clip → review and replay.",
    alt: "Handwritten system sketch connecting source media, multimodal analysis, scripts, timeline events, a builder, review, and replay"
  },
  {
    image: sketchPatterns,
    number: "02",
    title: "Editing as patterns",
    description: "Fonts, effects, transitions, example timelines, layering, agent-visible steps, and feedback-driven improvement.",
    alt: "Handwritten notes about building reusable editing patterns from fonts, effects, transitions, layers, and timeline examples"
  },
  {
    image: sketchLayers,
    number: "03",
    title: "A multimodal timeline",
    description: "Video, images, audio, transcripts, scene changes, and events represented as synchronized process layers.",
    alt: "Handwritten timeline sketch showing video, image, and audio layers becoming descriptions, transcripts, scenes, and events"
  },
  {
    image: sketchFeedback,
    number: "04",
    title: "The human feedback loop",
    description: "Events become story, story becomes a timeline, style becomes layers, and discrepancies become explicit feedback.",
    alt: "Handwritten feedback-loop sketch connecting event lists, story, timeline, draft, stylistic layering, human review, and revisions"
  }
];

const improvements = [
  {
    index: "A",
    title: "Analysis stopped being the edit",
    before: "One response mixed observations, story choices, timeline ranges, and a review score.",
    after: "Analysis now feeds an evidence catalog. EditScript owns intent; the timeline only contains accepted decisions."
  },
  {
    index: "B",
    title: "The agent lost mutation authority",
    before: "A model-generated operation list could be treated as permission to change the live cut.",
    after: "Models plan. Deterministic code compiles. A proposal names its base revision and waits for approval."
  },
  {
    index: "C",
    title: "Effect names became contracts",
    before: "Strings like “slow push,” “compressor,” and “agent polish” could look real without rendering.",
    after: "Versioned effects declare parameters, ordering, keyframes, fallbacks, preview fidelity, and export bindings."
  },
  {
    index: "D",
    title: "One timeline became revision history",
    before: "Undo meant hoping an in-memory mutation could be reversed correctly.",
    after: "Apply creates an immutable descendant. Revert is another revision, so intent and lineage remain inspectable."
  },
  {
    index: "E",
    title: "Feedback became useful data",
    before: "The sketch asked whether RLHF, RLAIF, or RSI should close the loop.",
    after: "The safe first step is explicit decision events: what changed, why, what the human kept, and what they rejected."
  },
  {
    index: "F",
    title: "Preview became a promise",
    before: "The UI could display effect badges even when pixels and samples were unchanged.",
    after: "The same evaluated RenderPlan feeds preview and export—or the UI discloses an approximation before approval."
  }
] as const;

const artifacts = ["AnalysisEnvelope", "EvidenceCatalog", "EditScript", "ResolutionLock", "CompiledProposal", "TimelineRevision", "RenderPlan"];

function Arrow({ direction = "right", label }: { direction?: "right" | "down"; label?: string }) {
  return (
    <div className={`diagram-arrow diagram-arrow-${direction}`} aria-hidden="true">
      {label && <small>{label}</small>}
      <span>{direction === "right" ? "→" : "↓"}</span>
    </div>
  );
}

function Node({ eyebrow, title, detail, tone = "neutral", className = "" }: {
  eyebrow?: string;
  title: string;
  detail?: string;
  tone?: "neutral" | "red" | "amber" | "violet" | "blue" | "green" | "cyan";
  className?: string;
}) {
  return (
    <div className={`diagram-node diagram-tone-${tone} ${className}`}>
      {eyebrow && <small>{eyebrow}</small>}
      <strong>{title}</strong>
      {detail && <p>{detail}</p>}
    </div>
  );
}

function CleanRedraws() {
  return (
    <div className="redraw-grid">
      <article className="redraw-card">
        <div className="redraw-card-head">
          <span>01</span>
          <div><small>GENERATION LOOP</small><h3>From source dump to reviewed clip</h3></div>
        </div>
        <div className="redraw-canvas redraw-pipeline">
          <div className="redraw-prompt"><span>CREATIVE INPUT</span><strong>Prompt</strong><i>↘</i></div>
          <div className="diagram-row redraw-source-row">
            <Node eyebrow="INGEST" title="Source dump" detail="Raw media + project context" tone="red" />
            <Arrow label="analyze" />
            <div className="diagram-node diagram-tone-amber redraw-analysis-node">
              <small>MULTIMODAL ANALYSIS</small><strong>Understand the source</strong>
              <div className="diagram-chip-row"><span>video</span><span>audio</span><span>text</span><span>vision</span><span>images</span></div>
            </div>
            <Arrow />
            <Node eyebrow="AUTHOR" title="Edit script" detail="Narrative intent + constraints" tone="violet" />
          </div>
          <Arrow direction="down" label="compile" />
          <div className="diagram-row redraw-build-row">
            <Node eyebrow="PLAN" title="Timeline events" tone="blue" />
            <Arrow />
            <Node eyebrow="EXECUTE" title="Builder" tone="cyan" />
            <Arrow />
            <Node eyebrow="OUTPUT" title="Clip" tone="green" />
            <Arrow />
            <Node eyebrow="VERIFY" title="Review" detail="Spec matching" tone="amber" />
          </div>
          <div className="redraw-review-loop">
            <span><b>✓</b> Match → ship</span>
            <span><b>↺</b> Mismatch → replay with discrepancy → Builder</span>
          </div>
        </div>
      </article>

      <article className="redraw-card">
        <div className="redraw-card-head">
          <span>02</span>
          <div><small>PATTERN SYSTEM</small><h3>Build the editing language layer by layer</h3></div>
        </div>
        <div className="redraw-canvas redraw-patterns">
          <div className="redraw-ingredients">
            <small>PATTERN INGREDIENTS</small>
            <div><span>Fonts</span><span>Effects</span><span>Transitions</span><span>Example timelines</span></div>
          </div>
          <Arrow direction="down" />
          <div className="redraw-pattern-steps">
            <div><i>1</i><strong>Decompose</strong><small>Break the edit into observable steps</small></div>
            <div><i>2</i><strong>Layer</strong><small>Build composition over time</small></div>
            <div><i>3</i><strong>Stack</strong><small>Combine effects with explicit order</small></div>
            <div><i>4</i><strong>Encode</strong><small>Save the recipe as a reusable pattern</small></div>
          </div>
          <div className="redraw-pattern-support">
            <div><small>AGENT VIEW</small><strong>Visible clip state + named operations</strong></div>
            <div><small>EXPERIMENTS</small><strong>Shaders · animation · timing</strong></div>
          </div>
          <div className="redraw-learning-loop">
            <span>Examples</span><b>→</b><span>Pattern attempt</span><b>→</b><span>Human / AI feedback</span><b>↺</b>
            <small>RLHF · RLAIF · iterative self-improvement</small>
          </div>
        </div>
      </article>

      <article className="redraw-card">
        <div className="redraw-card-head">
          <span>03</span>
          <div><small>MULTIMODAL TIMELINE</small><h3>Parallel media tracks become shared events</h3></div>
        </div>
        <div className="redraw-canvas redraw-timeline">
          <div className="redraw-tracks" aria-label="Synchronized media tracks">
            <div><strong>VIDEO</strong><span className="track-block track-a" /><span className="track-block track-b" /><span className="track-block track-c" /><small>V0 … Vn−1</small></div>
            <div><strong>IMAGE</strong><span className="track-block track-d" /><span className="track-block track-e" /><span className="track-block track-f" /><small>I0 … In−1</small></div>
            <div><strong>AUDIO</strong><span className="track-wave">▁▃▇▅▂▆▃▁▅▇▂▃</span><small>A0 … An−1</small></div>
          </div>
          <div className="redraw-time-axis"><span>00:00</span><i /><span>source time</span><i /><span>end</span></div>
          <div className="redraw-analysis-branches">
            <div><span className="branch-source">IMAGES</span><b>→</b><Node title="Multimodal descriptions" tone="violet" /></div>
            <div><span className="branch-source">AUDIO</span><b>→</b><Node title="Transcript + speech spans" tone="amber" /></div>
            <div><span className="branch-source">VIDEO</span><b>→</b><Node title="Audio event timeline" tone="cyan" /></div>
            <div><span className="branch-source">VIDEO</span><b>→</b><Node title="Image split + scene changes" tone="blue" /></div>
          </div>
          <div className="redraw-converge"><span>↘</span><span>↙</span></div>
          <Node eyebrow="SHARED OUTPUT" title="Evidence-backed event catalog" detail="Every observation keeps its source-time range and modality." tone="green" className="redraw-event-node" />
        </div>
      </article>

      <article className="redraw-card">
        <div className="redraw-card-head">
          <span>04</span>
          <div><small>HUMAN FEEDBACK LOOP</small><h3>Every discrepancy becomes the next revision</h3></div>
        </div>
        <div className="redraw-canvas redraw-feedback">
          <div className="diagram-row redraw-story-row">
            <Node title="Event list" tone="red" />
            <Arrow />
            <Node title="Story / narrative" tone="violet" />
            <Arrow />
            <Node title="Timeline" tone="blue" />
            <Arrow />
            <Node title="Draft" tone="cyan" />
          </div>
          <Arrow direction="down" label="stylistic layering" />
          <div className="redraw-version-row">
            <Node eyebrow="REVISION" title="V1" detail="A rendered, inspectable proposal" tone="green" />
            <Arrow />
            <Node eyebrow="DECISION" title="Present to human" detail="Preview · compare · comment" tone="amber" />
          </div>
          <div className="redraw-decision-branch">
            <div className="redraw-good"><small>GOOD?</small><strong>Done</strong><span>✓</span></div>
            <div className="redraw-change-path">
              <small>CHANGE REQUESTED</small>
              <div><span>Feedback Δ</span><b>→</b><span>Find discrepancies</span><b>→</b><span>Resolve</span><b>→</b><span>V(n+1)</span></div>
            </div>
          </div>
          <div className="redraw-return-loop"><span>↖</span> New revision returns to human review</div>
        </div>
      </article>
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className="about-page">
      <header className="about-nav">
        <Link className="about-brand" href="/" aria-label="Back to Nightcut editor">
          <span><Icon name="sparkle" size={16} /></span>
          <strong>NIGHTCUT</strong>
          <small>HOW IT WORKS</small>
        </Link>
        <nav aria-label="About page navigation">
          <a href="#system">System map</a>
          <a href="#notes">Field notes</a>
          <a href="#redraws">Clean redraws</a>
          <a href="#evolution">Evolution</a>
        </nav>
        <Link className="about-back" href="/">
          Open editor <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <div className="about-content">
        <section className="about-hero">
          <div className="about-hero-copy">
            <div className="about-eyebrow"><i /> Built from four notes on the way to a hackathon</div>
            <h1>Video editing as a<br /><em>reviewable program.</em></h1>
            <p>
              Nightcut turns multimodal evidence into an edit script, compiles that script into an inspectable proposal,
              and lets a human decide what becomes real. Creative planning stays flexible; execution stays deterministic.
            </p>
            <div className="about-principles" aria-label="Core system principles">
              <span><Icon name="eye" size={13} /> Evidence-grounded</span>
              <span><Icon name="command" size={13} /> Deterministic</span>
              <span><Icon name="check" size={13} /> Human-approved</span>
            </div>
          </div>
          <div className="about-hero-proof" aria-label="Project proof points">
            <div className="about-proof-grid" />
            <div className="about-proof-orbit orbit-one" />
            <div className="about-proof-orbit orbit-two" />
            <div className="about-proof-center"><Icon name="sparkle" size={26} /></div>
            <div className="about-proof-stat stat-one"><strong>4</strong><span>FIELD<br />SKETCHES</span></div>
            <div className="about-proof-stat stat-two"><strong>7</strong><span>PINNED<br />ARTIFACTS</span></div>
            <div className="about-proof-stat stat-three"><strong>26</strong><span>EFFECT<br />TESTS</span></div>
            <div className="about-proof-caption">Idea → contract → executable proof</div>
          </div>
        </section>

        <section className="about-section" id="system">
          <div className="about-section-heading">
            <div><span>01 / REFINED SYSTEM MAP</span><h2>The idea, made executable</h2></div>
            <p>Each boundary answers one question and hands a pinned artifact to the next stage.</p>
          </div>

          <div className="about-system-map">
            <div className="about-flow-rail">
              {stages.map((stage) => (
                <article className={`about-flow-stage accent-${stage.accent}`} key={stage.number}>
                  <div className="about-stage-top"><span>{stage.number}</span><i /></div>
                  <small>{stage.eyebrow}</small>
                  <h3>{stage.title}</h3>
                  <p>{stage.description}</p>
                  <div>{stage.tags.map((tag) => <b key={tag}>{tag}</b>)}</div>
                </article>
              ))}
            </div>

            <div className="about-plane-grid">
              <article>
                <span><Icon name="wand" size={15} /></span>
                <div><small>CREATIVE PLANE</small><h3>Models propose meaning</h3><p>Find the hook, shape the arc, choose a style recipe, and explain the intent.</p></div>
              </article>
              <article className="boundary-card">
                <span><Icon name="lock" size={15} /></span>
                <div><small>TRUST BOUNDARY</small><h3>Nothing mutates on belief</h3><p>Selectors freeze to exact evidence. Unsupported claims, stale bases, and invalid ranges stop visibly.</p></div>
              </article>
              <article>
                <span><Icon name="command" size={15} /></span>
                <div><small>RUNTIME PLANE</small><h3>Code proves the change</h3><p>Compile, simulate, diff, preview, commit, render, and verify against the same plan.</p></div>
              </article>
            </div>

            <div className="about-feedback-loop">
              <div className="feedback-arrow">↺</div>
              <div><small>EXPLICIT LEARNING LOOP</small><strong>Outcome events improve the next proposal</strong></div>
              <p>Human decisions update preferences and style evidence—never the already accepted timeline.</p>
            </div>
          </div>

          <div className="about-artifact-strip" aria-label="System artifacts">
            {artifacts.map((artifact, index) => (
              <div key={artifact}><span>{String(index + 1).padStart(2, "0")}</span><strong>{artifact}</strong></div>
            ))}
          </div>
        </section>

        <section className="about-section" id="notes">
          <div className="about-section-heading">
            <div><span>02 / ORIGINAL FIELD NOTES</span><h2>The source material</h2></div>
            <p>The rough diagrams are kept intact because the system should retain provenance for ideas, too.</p>
          </div>
          <div className="about-sketch-grid">
            {sketches.map((sketch, index) => (
              <figure className="about-sketch-card" key={sketch.number}>
                <a className="about-sketch-image" href={sketch.image.src} target="_blank" rel="noreferrer" aria-label={`Open original note ${sketch.number} at full resolution`}>
                  <Image src={sketch.image} alt={sketch.alt} sizes="(max-width: 760px) 90vw, (max-width: 1200px) 44vw, 24vw" priority={index === 0} />
                  <span>{sketch.number}</span>
                </a>
                <figcaption><small>NOTE {sketch.number}</small><h3>{sketch.title}</h3><p>{sketch.description}</p></figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="about-section" id="redraws">
          <div className="about-section-heading">
            <div><span>03 / CLEAN REDRAWS</span><h2>The sketches, made precise</h2></div>
            <p>Faithful recreations of the four original notes—clean enough to explain, while preserving the ideas and loops that made them useful.</p>
          </div>
          <CleanRedraws />
        </section>

        <section className="about-section" id="evolution">
          <div className="about-section-heading">
            <div><span>04 / AGENT SESSION EVOLUTION</span><h2>What became sharper</h2></div>
            <p>The sketches supplied the direction. Research, implementation design, and executable fixtures supplied the boundaries.</p>
          </div>
          <div className="about-improvement-grid">
            {improvements.map((item) => (
              <article key={item.index}>
                <div className="about-improvement-title"><span>{item.index}</span><h3>{item.title}</h3></div>
                <div className="about-before-after">
                  <div><small>EARLY IDEA</small><p>{item.before}</p></div>
                  <div><small>REFINED CONTRACT</small><p>{item.after}</p></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="about-effects-proof">
          <div className="about-effects-copy">
            <span>05 / EFFECTS AS DATA</span>
            <h2>Impact without effect soup.</h2>
            <p>Speed changes own time. Transitions own boundaries. Visual effects own pixels. Audio processors own buses. Every expressive choice names a motivation, a budget, a fallback, and its preview fidelity.</p>
            <div className="about-effect-tags">
              <span>constant rate</span><span>slow push</span><span>punch</span><span>shake</span><span>blur</span><span>grade</span><span>ducking</span>
            </div>
          </div>
          <div className="about-effect-stack" aria-label="Ordered effect stack">
            <div><i>01</i><span>TIME MAP</span><strong>1.15×</strong></div>
            <div><i>02</i><span>GEOMETRY</span><strong>push → punch</strong></div>
            <div><i>03</i><span>PICTURE</span><strong>blur → grade</strong></div>
            <div><i>04</i><span>AUDIO</span><strong>dialogue → mix</strong></div>
            <div><i>05</i><span>MASTER</span><strong>render → QC</strong></div>
          </div>
        </section>

        <section className="about-closing">
          <div><Icon name="sparkle" size={22} /></div>
          <p>“The model may imagine the edit.<br /><strong>The system must be able to explain it.”</strong></p>
          <Link href="/">Build the next cut <span aria-hidden="true">→</span></Link>
        </section>
      </div>
    </main>
  );
}
