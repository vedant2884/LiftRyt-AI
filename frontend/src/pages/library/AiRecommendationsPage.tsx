import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  MessageCircleQuestion,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { fetchRecommendations } from "../../api/recommendations";
import { Skeleton } from "../../components/Skeleton";
import type { Recommendations, RecommendationType } from "../../types/library";

const ICON_BY_TYPE: Record<RecommendationType, typeof Sparkles> = {
  missing_muscle_group: Target,
  variation: Sparkles,
  adherence: TrendingUp,
  progression: CalendarClock,
  goal_based: Sparkles,
};

const humanize = (s: string) => s.replace(/_/g, " ");

export default function AiRecommendationsPage() {
  const [data, setData] = useState<Recommendations | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecommendations()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-6">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-4/5" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.cards.length === 0) return null;

  return (
    <div>
      <p className="mb-6 flex items-center gap-2 text-sm text-ink-muted">
        <Sparkles size={14} className="text-accent" />
        Grounded in your active split, its completion history, and your goals, not generic advice.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.cards.map((card, i) => {
          const Icon = card.type === "goal_based" && card.action_href === "/coach" ? MessageCircleQuestion : ICON_BY_TYPE[card.type];
          return (
            <div
              key={i}
              className="group relative overflow-hidden rounded-2xl border border-line bg-surface/60 p-6 backdrop-blur-sm transition hover:border-line-strong"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
                <Icon size={18} className="text-accent" strokeWidth={2} />
              </div>
              <h2 className="mb-1.5 font-medium">{card.title}</h2>
              <p className="mb-4 text-sm text-ink-secondary">{card.description}</p>

              {card.exercises.length > 0 && (
                <ul className="mb-4 space-y-1.5">
                  {card.exercises.map((ex) => (
                    <li key={ex.id} className="flex items-center justify-between text-sm">
                      <span className="text-ink">{ex.name}</span>
                      <span className="text-xs capitalize text-ink-muted">{humanize(ex.category)}</span>
                    </li>
                  ))}
                </ul>
              )}

              {card.action_href && card.action_label && (
                <Link
                  to={card.action_href}
                  className="inline-flex items-center gap-1 text-sm font-medium text-accent transition group-hover:gap-2"
                >
                  {card.action_label}
                  <ArrowRight size={14} />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
