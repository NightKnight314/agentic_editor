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
                <div className="about-sketch-image">
                  <Image src={sketch.image} alt={sketch.alt} sizes="(max-width: 760px) 90vw, (max-width: 1200px) 44vw, 24vw" priority={index === 0} />
                  <span>{sketch.number}</span>
                </div>
                <figcaption><small>NOTE {sketch.number}</small><h3>{sketch.title}</h3><p>{sketch.description}</p></figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="about-section" id="evolution">
          <div className="about-section-heading">
            <div><span>03 / AGENT SESSION EVOLUTION</span><h2>What became sharper</h2></div>
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
            <span>04 / EFFECTS AS DATA</span>
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
