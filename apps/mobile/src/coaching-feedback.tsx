import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { coachingAreaLabels, coachingOverallScore, type CoachingReview, type FeedbackAssessment } from "@coach/core";
import { Card, Copy, Heading, Icon, PillTag, ProgressBar, useTheme } from "./ui";

function SectionTitle({ children }: { children: string }) {
  const theme = useTheme();
  return <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.ink }]}>{children}</Text>;
}

function Quote({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.quote, { borderLeftColor: theme.positive, backgroundColor: theme.isDark ? "#064e3b22" : "#f0fdf4" }]}>
      <Copy>“{text}”</Copy>
    </View>
  );
}

function Scorecard({ review }: { review: CoachingReview }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<string | null>(null);
  const overall = coachingOverallScore(review);

  return (
    <Card>
      <View style={{ gap: 6 }}>
        <Heading eyebrow="Competency Breakdown">Communication Scorecard</Heading>
        <Copy>Estimates across key dimensions from your independent retry. Tap any area to review the quoted evidence.</Copy>
      </View>

      {review.scores.map(area => {
        const label = coachingAreaLabels[area.area];
        const numScore = area.score ?? 0;
        const scoreDisplay = area.score === null ? "N/A" : `${area.score}/10`;
        const open = expanded === area.area;
        return (
          <View key={area.area} style={[styles.scoreArea, { borderBottomColor: theme.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${scoreDisplay}. ${open ? "Hide" : "Show"} evidence`}
              accessibilityState={{ expanded: open }}
              onPress={() => setExpanded(open ? null : area.area)}
              style={styles.scoreRow}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={[styles.areaLabel, { color: theme.ink }]}>{label}</Text>
                  <Text style={[styles.score, { color: theme.ink, fontWeight: "700" }]}>{scoreDisplay}</Text>
                </View>
                {area.score !== null && (
                  <ProgressBar value={numScore * 10} color={numScore >= 7 ? theme.positive : theme.accent} />
                )}
              </View>
            </Pressable>
            {open && (
              <View style={styles.details}>
                <Copy>{area.rationale}</Copy>
                {area.evidence.map((evidence, index) => (
                  <Quote key={`${evidence.turnId}-${index}`} text={evidence.quote} />
                ))}
              </View>
            )}
          </View>
        );
      })}

      <View style={[styles.scoreRow, { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12 }]}>
        <Text style={[styles.areaLabel, styles.bold, { color: theme.ink }]}>Overall Composite Score</Text>
        <PillTag label={overall === null ? "UNASSESSED" : `${overall} / 10`} tone="positive" />
      </View>
    </Card>
  );
}

export function CoachingFeedback({ feedback }: { feedback: FeedbackAssessment }) {
  const review = feedback.coachingReview;
  const theme = useTheme();

  if (!review) {
    return (
      <>
        <Copy>Review evidence saved.</Copy>
        {feedback.priorities.map((priority, index) => (
          <Card key={`${priority.turnId}-${index}`}>
            <SectionTitle>{`Priority ${index + 1}`}</SectionTitle>
            <Copy>{priority.observation}</Copy>
            <Quote text={priority.quote} />
            <Copy>Next exercise: {priority.nextExercise}</Copy>
          </Card>
        ))}
      </>
    );
  }

  const overall = coachingOverallScore(review);
  const ratingTier = overall ? (overall >= 8 ? "Executive Ready" : overall >= 6.5 ? "Proficient" : "Developing") : "Assessed";

  return (
    <>
      <Card tone="accent">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ gap: 4 }}>
            <Heading eyebrow="Overall Assessment">{ratingTier}</Heading>
            <Copy>{review.summary}</Copy>
          </View>
          <View style={{ alignItems: "center", justifyContent: "center", width: 72, height: 72, borderRadius: 36, backgroundColor: theme.surface, borderWidth: 2, borderColor: theme.positive }}>
            <Text style={{ fontSize: 24, fontWeight: "800", color: theme.positive }}>{overall ?? "—"}</Text>
            <Text style={{ fontSize: 10, fontWeight: "600", color: theme.muted }}>OUT OF 10</Text>
          </View>
        </View>
      </Card>

      <Card>
        <SectionTitle>Your Opening Delivery</SectionTitle>
        <Quote text={review.opening.quote} />
        <Copy>{review.opening.observation}</Copy>
      </Card>

      <Scorecard review={review} />

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="spark" size={22} color={theme.positive} />
          <SectionTitle>What You Did Well</SectionTitle>
        </View>
        {review.strengths.length === 0 && (
          <Copy>Continue practicing in the next scenario to demonstrate stronger structured evidence.</Copy>
        )}
        {review.strengths.map((strength, index) => (
          <View style={styles.details} key={`${strength.turnId}-${index}`}>
            <Copy>{strength.observation}</Copy>
            <Quote text={strength.quote} />
          </View>
        ))}
      </Card>

      {feedback.priorities.map((priority, index) => (
        <Card key={`${priority.turnId}-${index}`}>
          <SectionTitle>{priority.coaching?.title ?? `Priority Improvement · ${index + 1}`}</SectionTitle>
          <Copy>{priority.observation}</Copy>
          <Quote text={priority.quote} />
          {priority.coaching && (
            <>
              <Copy>{priority.coaching.whyItMatters}</Copy>
              {priority.coaching.steps.map((step, stepIndex) => (
                <Copy key={stepIndex}>{`${stepIndex + 1}. ${step}`}</Copy>
              ))}
              {Boolean(priority.coaching.suggestedWording) && (
                <>
                  <Copy>Suggested phrasing to practice:</Copy>
                  <Quote text={priority.coaching.suggestedWording!} />
                </>
              )}
            </>
          )}
          <PillTag label={`Next: ${priority.nextExercise}`} tone="accent" />
        </Card>
      ))}

      <Card tone="accent">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="spark" size={22} color={theme.accent} />
          <SectionTitle>A stronger version of your answer</SectionTitle>
        </View>
        <Copy>Use this as an example of clearer wording, then make it your own:</Copy>
        <Quote text={review.strongerAnswer.text} />
        <Copy>{review.strongerAnswer.whyStronger}</Copy>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: "700", lineHeight: 24, flexShrink: 1 },
  quote: { borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 8, paddingRight: 8, borderRadius: 4, marginVertical: 4 },
  scoreArea: { borderBottomWidth: 1, paddingVertical: 8 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingVertical: 6 },
  areaLabel: { fontSize: 15, fontWeight: "600" },
  score: { fontSize: 15 },
  details: { gap: 8, paddingVertical: 8 },
  bold: { fontWeight: "700" },
});
