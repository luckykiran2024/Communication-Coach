import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { coachingAreaLabels, coachingOverallScore, type CoachingReview, type FeedbackAssessment } from "@coach/core";
import { Card, Copy, useTheme } from "./ui";

function SectionTitle({ children }: { children: string }) {
  const theme = useTheme();
  return <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.ink }]}>{children}</Text>;
}

function Quote({ text }: { text: string }) {
  const theme = useTheme();
  return <View style={[styles.quote, { borderLeftColor: theme.positive }]}><Copy>“{text}”</Copy></View>;
}

function Scorecard({ review }: { review: CoachingReview }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<string | null>(null);
  const overall = coachingOverallScore(review);
  return <Card>
    <SectionTitle>Communication scorecard</SectionTitle>
    <Copy>AI coaching estimates for your independent retry—not a certified ability score. Tap an area to see its evidence.</Copy>
    {review.scores.map(area => {
      const label = coachingAreaLabels[area.area];
      const score = area.score === null ? "Not assessed" : `${area.score}/10`;
      const open = expanded === area.area;
      return <View key={area.area} style={[styles.scoreArea, { borderBottomColor: theme.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${score}. ${open ? "Hide" : "Show"} evidence`}
          accessibilityState={{ expanded: open }} aria-expanded={open} onPress={() => setExpanded(open ? null : area.area)}
          style={styles.scoreRow}>
          <Text style={[styles.areaLabel, { color: theme.ink }]}>{label}</Text>
          <Text style={[styles.score, { color: theme.ink }]}>{score}</Text>
        </Pressable>
        {open && <View style={styles.details}>
          <Copy>{area.rationale}</Copy>
          {area.evidence.map((evidence, index) => <Quote key={`${evidence.turnId}-${index}`} text={evidence.quote} />)}
        </View>}
      </View>;
    })}
    <View style={styles.scoreRow}>
      <Text style={[styles.areaLabel, styles.bold, { color: theme.ink }]}>Overall estimate</Text>
      <Text style={[styles.score, styles.bold, { color: theme.ink }]}>{overall === null ? "Not assessed" : `${overall}/10`}</Text>
    </View>
    <Copy>Equal-weight average of scored areas, rounded to one decimal. At least four assessable areas are required.</Copy>
  </Card>;
}

export function CoachingFeedback({ feedback }: { feedback: FeedbackAssessment }) {
  const review = feedback.coachingReview;
  if (!review) return <>
    <Copy>This earlier review has no detailed scorecard. Its original evidence is preserved; no scores have been invented.</Copy>
    {feedback.priorities.map((priority, index) => <Card key={`${priority.turnId}-${index}`}>
      <SectionTitle>{`Priority ${index + 1}`}</SectionTitle>
      <Copy>{priority.observation}</Copy><Quote text={priority.quote} />
      <Copy>Next exercise: {priority.nextExercise}</Copy>
      <Copy>Evidence confidence: {priority.confidence}</Copy>
    </Card>)}
  </>;
  const overall = coachingOverallScore(review);
  return <>
    <SectionTitle>{overall === null ? "Overall estimate · not enough evidence" : `Overall estimate · ${overall}/10`}</SectionTitle>
    <Copy>AI coaching estimate based on the saved words in your independent retry—not a certified assessment.</Copy>
    <Copy>{review.summary}</Copy>
    <Card>
      <SectionTitle>Your opening</SectionTitle>
      <Quote text={review.opening.quote} /><Copy>{review.opening.observation}</Copy>
    </Card>
    <Scorecard review={review} />
    <Card>
      <SectionTitle>What you did well</SectionTitle>
      {review.strengths.length === 0 && <Copy>No specific strength was verified in the saved response. Use the next exercise
        to build more evidence.</Copy>}
      {review.strengths.map((strength, index) => <View style={styles.details} key={`${strength.turnId}-${index}`}>
        <Copy>{strength.observation}</Copy><Quote text={strength.quote} />
      </View>)}
    </Card>
    {feedback.priorities.map((priority, index) => <Card key={`${priority.turnId}-${index}`}>
      <SectionTitle>{priority.coaching?.title ?? `Where to strengthen your answer · ${index + 1}`}</SectionTitle>
      <Copy>{priority.observation}</Copy><Quote text={priority.quote} />
      {priority.coaching && <>
        <Copy>{priority.coaching.whyItMatters}</Copy>
        {priority.coaching.steps.map((step, stepIndex) => <Copy key={stepIndex}>{`${stepIndex + 1}. ${step}`}</Copy>)}
        {priority.coaching.suggestedWording && <>
          <Copy>Suggested wording—not your original response:</Copy><Quote text={priority.coaching.suggestedWording} />
        </>}
      </>}
      <Copy>Practice this next: {priority.nextExercise}</Copy>
      <Copy>Evidence confidence: {priority.confidence}</Copy>
    </Card>)}
    <Card tone="accent">
      <SectionTitle>A stronger version of your answer</SectionTitle>
      <Copy>Illustrative rewrite—not your original words or the only correct answer. Adapt it to facts you can verify.</Copy>
      <Quote text={review.strongerAnswer.text} /><Copy>{review.strongerAnswer.whyStronger}</Copy>
    </Card>
  </>;
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 20, fontWeight: "700", lineHeight: 27, flexShrink: 1 },
  quote: { borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 4 },
  scoreArea: { borderBottomWidth: 1 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingVertical: 10 },
  areaLabel: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 22 },
  score: { flexShrink: 1, maxWidth: "42%", fontSize: 15, lineHeight: 22, textAlign: "right" },
  details: { gap: 12, paddingBottom: 12 },
  bold: { fontWeight: "700" },
});
