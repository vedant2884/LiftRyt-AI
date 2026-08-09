import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useAuthStore } from "../store/authStore";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const CTA_LABEL = "Get started free";

interface Feature {
  title: string;
  description: string;
  icon: ReactNode;
}

const FEATURES: Feature[] = [
  {
    title: "AI Gym Coach",
    description:
      "A chat coach that checks your real weight trend and macro targets before it answers, and uses real tools instead of guessing.",
    icon: (
      <path
        d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
        strokeWidth="1.5"
      />
    ),
  },
  {
    title: "Weight Trend Analytics",
    description:
      "Log your weight and see 7-day and 30-day trends, plus a projected date for hitting your goal weight, based on your actual logged history, not a guess.",
    icon: <path d="M3 17 9 11l4 4 8-8M15 6h6v6" strokeWidth="1.5" />,
  },
  {
    title: "Weekly Check-Ins",
    description:
      "On demand, the coach reviews your recent trend and macro adherence and writes a short, honest check-in, not a generic pep talk.",
    icon: (
      <path
        d="M6 8v8M18 8v8M2 12h2M20 12h2M6 12h12"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    ),
  },
  {
    title: "Rule-Based Split Generator",
    description:
      "Give it your days per week, experience, and goal, and get a real structured split with a stated reason for every exercise, not an AI freehanding it.",
    icon: (
      <path
        d="M4 4h16v16H4z M4 10h16 M10 10v10"
        strokeWidth="1.5"
      />
    ),
  },
  {
    title: "Macro & Calorie Targets",
    description:
      "A calorie and macro split tuned to your goal and bodyweight using a trusted, established formula, saved once and referenced everywhere.",
    icon: <path d="M12 2v10l7 7A10 10 0 1 0 12 2Z" strokeWidth="1.5" />,
  },
  {
    title: "Exercise Library + Smart Search",
    description:
      "Browse by muscle, equipment, and difficulty, or just describe what you need in plain words and get relevant exercises back, even if you don't know the exact name.",
    icon: (
      <path
        d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM21 21l-4.35-4.35"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    ),
  },
];

const STEPS = [
  {
    n: "01",
    title: "Tell it about you",
    body: "Sign up with your stats, activity level, and goal. That's the profile every calculation and recommendation is grounded in.",
  },
  {
    n: "02",
    title: "Log your weight, set your targets",
    body: "Weight entries feed your trend chart, and your macro targets are calculated and saved so the coach can reference them.",
  },
  {
    n: "03",
    title: "Get guidance that's actually yours",
    body: "Ask the coach anything. It checks your real data first, builds a split or a macro target when needed, and explains why.",
  },
];

export default function HomePage() {
  const isAuthenticated = useAuthStore((s) => s.user !== null);

  return (
    <main className="bg-bg text-ink">
      {/* Nav */}
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-semibold tracking-tight">
            Lift<span className="text-accent">Ryt</span> AI
          </span>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.97]"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm text-ink-secondary hover:text-ink">
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.97]"
                >
                  {CTA_LABEL}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-28 text-center">
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--accent)" }}
          aria-hidden
        />
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="relative mx-auto max-w-3xl"
        >
          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="mb-4 text-sm font-medium uppercase tracking-widest text-accent"
          >
            An AI gym coach that knows your actual training
          </motion.p>
          <motion.h1
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-5xl font-semibold tracking-tight sm:text-6xl"
          >
            Train with data,
            <br />
            not vibes.
          </motion.h1>
          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="mx-auto mt-6 max-w-xl text-lg text-ink-secondary"
          >
            LiftRyt AI tracks your weight and macro targets, then gives you a
            coach that checks your real history before it answers, instead
            of freehanding generic advice.
          </motion.p>
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="mt-10 flex items-center justify-center gap-4"
          >
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="rounded-md bg-accent px-6 py-3 font-medium text-white transition hover:opacity-90 active:scale-[0.97]"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/signup"
                  className="rounded-md bg-accent px-6 py-3 font-medium text-white transition hover:opacity-90 active:scale-[0.97]"
                >
                  {CTA_LABEL}
                </Link>
                <Link
                  to="/login"
                  className="rounded-md border border-line-strong px-6 py-3 font-medium transition hover:bg-surface-hover active:scale-[0.97]"
                >
                  Log in
                </Link>
              </>
            )}
          </motion.div>
        </motion.div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
          className="mb-14 text-center"
        >
          <motion.h2 variants={fadeUp} className="text-3xl font-semibold tracking-tight">
            Every core feature is real, not a mockup
          </motion.h2>
          <motion.p variants={fadeUp} className="mx-auto mt-3 max-w-xl text-ink-secondary">
            No fake demo data and no screenshots of screens that don't work. Every
            number the coach gives you is calculated from your own logged history.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              transition={{ duration: 0.4 }}
              whileHover={{ y: -4 }}
              className="rounded-xl border border-line bg-surface p-6"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="mb-4 h-8 w-8 text-accent"
              >
                {f.icon}
              </svg>
              <h3 className="mb-2 font-medium">{f.title}</h3>
              <p className="text-sm text-ink-secondary">{f.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-surface/50 px-6 py-20">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
          className="mx-auto max-w-6xl"
        >
          <motion.h2
            variants={fadeUp}
            className="mb-14 text-center text-3xl font-semibold tracking-tight"
          >
            How it works
          </motion.h2>
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            {STEPS.map((s) => (
              <motion.div key={s.n} variants={fadeUp} transition={{ duration: 0.4 }}>
                <p className="mb-3 text-sm font-semibold text-accent">{s.n}</p>
                <h3 className="mb-2 font-medium">{s.title}</h3>
                <p className="text-sm text-ink-secondary">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-24 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
        >
          <motion.h2 variants={fadeUp} className="text-3xl font-semibold tracking-tight">
            Your training data is the whole point.
          </motion.h2>
          <motion.p variants={fadeUp} className="mx-auto mt-3 max-w-md text-ink-secondary">
            Start logging your weight, and the coach gets more useful with every entry.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-block rounded-md bg-accent px-8 py-3 font-medium text-white transition hover:opacity-90 active:scale-[0.97]"
              >
                Go to dashboard
              </Link>
            ) : (
              <Link
                to="/signup"
                className="inline-block rounded-md bg-accent px-8 py-3 font-medium text-white transition hover:opacity-90 active:scale-[0.97]"
              >
                {CTA_LABEL}
              </Link>
            )}
          </motion.div>
        </motion.div>
      </section>

      <footer className="border-t border-line px-6 py-8 text-center text-xs text-ink-muted">
        LiftRyt AI is a portfolio project built to demonstrate a real, working full-stack app.
        Not a substitute for professional medical or nutrition advice.
      </footer>
    </main>
  );
}
