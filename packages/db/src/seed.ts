import { db } from "./client";
import {
  users,
  learningObjects,
  concepts,
  conceptEdges,
  userConceptState,
} from "./schema";

const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

async function seed() {
  console.log("Seeding database…");

  // 1. Test user
  await db
    .insert(users)
    .values({
      id: TEST_USER_ID,
      email: "test@learngraph.dev",
      displayName: "Test User",
      timezone: "America/New_York",
      onboarding: { completed: true },
      preferences: { dailyReviewBudget: 20 },
      subscription: "free",
    })
    .onConflictDoNothing();

  console.log("  ✓ Test user created");

  // 2. Sample learning object
  const [lo] = await db
    .insert(learningObjects)
    .values({
      userId: TEST_USER_ID,
      title: "Introduction to Machine Learning",
      sourceType: "pdf",
      status: "ready",
      rawText: "Machine learning is a subfield of artificial intelligence...",
      summaryTldr:
        "An overview of ML fundamentals including supervised, unsupervised, and reinforcement learning paradigms.",
      summaryKeyPoints: JSON.stringify([
        "ML learns patterns from data without explicit programming",
        "Supervised learning uses labeled training data",
        "Unsupervised learning discovers hidden structure",
        "Neural networks are universal function approximators",
        "Overfitting is the primary risk in model training",
      ]),
      summaryDeep:
        "Machine learning represents a paradigm shift in computing where systems improve through experience rather than explicit programming...",
    })
    .returning();

  console.log("  ✓ Sample learning object created");

  // 3. Sample concepts
  const conceptData = [
    {
      canonicalName: "machine_learning",
      displayName: "Machine Learning",
      definition:
        "A subfield of AI that enables systems to learn and improve from experience without being explicitly programmed.",
      difficultyLevel: 2,
      bloomLevel: "understand",
      domain: "computer_science",
    },
    {
      canonicalName: "supervised_learning",
      displayName: "Supervised Learning",
      definition:
        "A type of ML where the model is trained on labeled data, learning to map inputs to known outputs.",
      difficultyLevel: 2,
      bloomLevel: "understand",
      domain: "computer_science",
    },
    {
      canonicalName: "neural_network",
      displayName: "Neural Network",
      definition:
        "A computing system inspired by biological neural networks, consisting of interconnected layers of nodes.",
      difficultyLevel: 3,
      bloomLevel: "apply",
      domain: "computer_science",
    },
    {
      canonicalName: "gradient_descent",
      displayName: "Gradient Descent",
      definition:
        "An optimization algorithm that iteratively adjusts parameters in the direction of steepest decrease of a loss function.",
      difficultyLevel: 4,
      bloomLevel: "analyze",
      domain: "mathematics",
    },
    {
      canonicalName: "overfitting",
      displayName: "Overfitting",
      definition:
        "When a model learns the training data too well, including noise, and fails to generalize to new data.",
      difficultyLevel: 3,
      bloomLevel: "evaluate",
      domain: "computer_science",
    },
  ];

  const insertedConcepts = await db
    .insert(concepts)
    .values(conceptData)
    .onConflictDoNothing()
    .returning();

  console.log(`  ✓ ${insertedConcepts.length} concepts created`);

  // 4. Concept edges (prerequisite relationships)
  if (insertedConcepts.length >= 4) {
    const byName = Object.fromEntries(
      insertedConcepts.map((c) => [c.canonicalName, c.id])
    );

    await db
      .insert(conceptEdges)
      .values([
        {
          sourceId: byName.machine_learning!,
          targetId: byName.supervised_learning!,
          edgeType: "prerequisite",
          confidence: 0.95,
        },
        {
          sourceId: byName.machine_learning!,
          targetId: byName.neural_network!,
          edgeType: "prerequisite",
          confidence: 0.9,
        },
        {
          sourceId: byName.neural_network!,
          targetId: byName.gradient_descent!,
          edgeType: "prerequisite",
          confidence: 0.95,
        },
        {
          sourceId: byName.neural_network!,
          targetId: byName.overfitting!,
          edgeType: "related_to",
          confidence: 0.8,
        },
      ])
      .onConflictDoNothing();

    console.log("  ✓ Concept edges created");
  }

  // 5. User concept states (simulated progress)
  if (insertedConcepts.length >= 2) {
    await db
      .insert(userConceptState)
      .values([
        {
          userId: TEST_USER_ID,
          conceptId: insertedConcepts[0]!.id,
          masteryLevel: 3,
          fsrsStability: 10.5,
          fsrsDifficulty: 4.2,
          fsrsState: "review",
          fsrsReps: 5,
          lastReviewAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          nextReviewAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        },
        {
          userId: TEST_USER_ID,
          conceptId: insertedConcepts[1]!.id,
          masteryLevel: 1,
          fsrsStability: 1.2,
          fsrsDifficulty: 5.8,
          fsrsState: "learning",
          fsrsReps: 1,
          lastReviewAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          nextReviewAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // overdue
        },
      ])
      .onConflictDoNothing();

    console.log("  ✓ User concept states created");
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
