import type { LucideIcon } from "lucide-react";
import {
  Code2,
  Binary,
  Database,
  Cpu,
  Workflow,
  Brain,
  Layers,
  Sigma,
  BarChart3,
  Cloud,
  Server,
  Network,
  Terminal,
  GitBranch,
  Shield,
  Calculator,
  Atom,
  FlaskConical,
  Microscope,
  Rocket,
  TrendingUp,
  DollarSign,
  Briefcase,
  Users,
  Palette,
  PenTool,
  Camera,
  Music,
  Globe,
} from "lucide-react";

export type Topic = {
  id: string;
  label: string;
  icon: LucideIcon;
  category: string;
};

export type TopicCategory = {
  id: string;
  label: string;
  topics: Topic[];
};

export const TOPIC_CATEGORIES: TopicCategory[] = [
  {
    id: "programming",
    label: "Programming",
    topics: [
      { id: "python", label: "Python", icon: Code2, category: "programming" },
      { id: "javascript", label: "JavaScript", icon: Binary, category: "programming" },
      { id: "typescript", label: "TypeScript", icon: Code2, category: "programming" },
      { id: "rust", label: "Rust", icon: Cpu, category: "programming" },
      { id: "sql", label: "SQL", icon: Database, category: "programming" },
      { id: "go", label: "Go", icon: Workflow, category: "programming" },
    ],
  },
  {
    id: "ai_data",
    label: "AI & Data",
    topics: [
      { id: "machine_learning", label: "Machine Learning", icon: Brain, category: "ai_data" },
      { id: "deep_learning", label: "Deep Learning", icon: Layers, category: "ai_data" },
      { id: "statistics", label: "Statistics", icon: Sigma, category: "ai_data" },
      { id: "data_analysis", label: "Data Analysis", icon: BarChart3, category: "ai_data" },
      { id: "llms", label: "LLMs & Prompting", icon: Brain, category: "ai_data" },
    ],
  },
  {
    id: "technology",
    label: "Technology",
    topics: [
      { id: "cloud", label: "Cloud & AWS", icon: Cloud, category: "technology" },
      { id: "devops", label: "Docker & K8s", icon: Server, category: "technology" },
      { id: "system_design", label: "System Design", icon: Network, category: "technology" },
      { id: "linux", label: "Linux", icon: Terminal, category: "technology" },
      { id: "git", label: "Git", icon: GitBranch, category: "technology" },
      { id: "cybersecurity", label: "Cybersecurity", icon: Shield, category: "technology" },
    ],
  },
  {
    id: "science",
    label: "Science",
    topics: [
      { id: "calculus", label: "Calculus", icon: Calculator, category: "science" },
      { id: "linear_algebra", label: "Linear Algebra", icon: Sigma, category: "science" },
      { id: "physics", label: "Physics", icon: Atom, category: "science" },
      { id: "chemistry", label: "Chemistry", icon: FlaskConical, category: "science" },
      { id: "biology", label: "Biology", icon: Microscope, category: "science" },
    ],
  },
  {
    id: "business",
    label: "Business",
    topics: [
      { id: "product_management", label: "Product Mgmt", icon: Rocket, category: "business" },
      { id: "marketing", label: "Marketing", icon: TrendingUp, category: "business" },
      { id: "finance", label: "Finance", icon: DollarSign, category: "business" },
      { id: "entrepreneurship", label: "Startups", icon: Briefcase, category: "business" },
      { id: "leadership", label: "Leadership", icon: Users, category: "business" },
    ],
  },
  {
    id: "creative",
    label: "Creative",
    topics: [
      { id: "design", label: "Design", icon: Palette, category: "creative" },
      { id: "writing", label: "Writing", icon: PenTool, category: "creative" },
      { id: "photography", label: "Photography", icon: Camera, category: "creative" },
      { id: "music_theory", label: "Music Theory", icon: Music, category: "creative" },
      { id: "languages", label: "Languages", icon: Globe, category: "creative" },
    ],
  },
];

export const ALL_TOPICS: Topic[] = TOPIC_CATEGORIES.flatMap((c) => c.topics);

export function getTopicById(id: string): Topic | undefined {
  return ALL_TOPICS.find((t) => t.id === id);
}

export function getTopicsByIds(ids: string[]): Topic[] {
  return ids.map((id) => getTopicById(id)).filter((t): t is Topic => t !== undefined);
}
