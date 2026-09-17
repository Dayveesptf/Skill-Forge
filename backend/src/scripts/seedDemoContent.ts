import "dotenv/config";
import mongoose, { Types } from "mongoose";
import bcrypt from "bcryptjs";

import { env } from "../config/env";
import { User } from "../models/User";
import { UserRole } from "../constants/roles";
import { Organization } from "../models/Organization";
import { FrameworkVersion } from "../models/FrameworkVersion";
import { Skill } from "../models/Skill";
import { SkillLevel } from "../models/SkillLevel";
import { BehaviouralFactor } from "../models/BehaviouralFactor";
import { EvidencePrompt } from "../models/EvidencePrompt";
import { RoleProfile, RoleProfileStatus } from "../models/RoleProfile";
import { LearningResource } from "../models/LearningResource";
import { CareerPath, CareerPathChangeType } from "../models/CareerPath";
import {
  Assessment,
  AssessmentStatus,
  AssessmentType,
} from "../models/Assessment";
import { AssessmentSection } from "../models/AssessmentSection";
import {
  AssessmentQuestion,
  AssessmentQuestionType,
  QuestionDifficulty,
} from "../models/AssessmentQuestion";
import {
  AssessmentAssignment,
  AssessmentAssignmentStatus,
} from "../models/AssessmentAssignment";
import {
  SelfAssessmentCampaign,
  SelfAssessmentCampaignScope,
  SelfAssessmentCampaignStatus,
} from "../models/SelfAssessmentCampaign";
import { SelfAssessment, SelfAssessmentStatus } from "../models/SelfAssessment";
import { SelfAssessmentResponse, SelfAssessmentConfidence } from "../models/SelfAssessmentResponse";
import { Notification, NotificationPriority, NotificationType } from "../models/Notification";
import { IndustryTemplate } from "../models/IndustryTemplate";
import { createCampaign, launchCampaign } from "../modules/selfAssessmentCampaigns/selfAssessmentCampaign.service";

const ORG_SLUG = process.env.SEED_ORG_SLUG || "demo-org";
const ORG_NAME = process.env.SEED_ORG_NAME || "Demo Organization";

const PLATFORM_ADMIN_EMAIL =
  process.env.SEED_PLATFORM_ADMIN_EMAIL || "platform-admin@skillforge.test";
const PLATFORM_ADMIN_PASSWORD =
  process.env.SEED_PLATFORM_ADMIN_PASSWORD || "PlatformAdmin!123";

const ORG_ADMIN_EMAIL =
  process.env.SEED_ORG_ADMIN_EMAIL || "org-admin@skillforge.test";
const ORG_ADMIN_PASSWORD =
  process.env.SEED_ORG_ADMIN_PASSWORD || "OrgAdmin!123";

const STAFF_EMAIL =
  process.env.SEED_STAFF_EMAIL || "staff@skillforge.test";
const STAFF_PASSWORD =
  process.env.SEED_STAFF_PASSWORD || "Staff!123";

const MANAGER_EMAIL =
  process.env.SEED_MANAGER_EMAIL || "manager@skillforge.test";
const MANAGER_PASSWORD =
  process.env.SEED_MANAGER_PASSWORD || "Manager!123";

const BCRYPT_ROUNDS = 12;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function oid(value: string | Types.ObjectId) {
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(value);
}

async function findOrCreateUser(params: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId?: Types.ObjectId;
  managerId?: Types.ObjectId;
  jobTitle?: string;
  department?: string;
}) {
  let user = await User.findOne({ email: params.email.toLowerCase() }).select(
    "+passwordHash",
  );

  if (!user) {
    user = await User.create({
      firstName: params.firstName,
      lastName: params.lastName,
      email: params.email.toLowerCase(),
      passwordHash: await bcrypt.hash(params.password, BCRYPT_ROUNDS),
      role: params.role,
      organizationId: params.organizationId,
      managerId: params.managerId,
      jobTitle: params.jobTitle,
      department: params.department,
      isActive: true,
    });
    console.log(`✓ Created ${params.role}: ${params.email}`);
  } else {
    const update: Record<string, unknown> = {};

    if (!user.organizationId && params.organizationId) {
      update.organizationId = params.organizationId;
    }
    if (params.managerId) update.managerId = params.managerId;
    if (params.jobTitle) update.jobTitle = params.jobTitle;
    if (params.department) update.department = params.department;
    if (user.role !== params.role) {
      throw new Error(
        `Existing user ${params.email} has role ${user.role}, expected ${params.role}`,
      );
    }

    if (Object.keys(update).length > 0) {
      await User.updateOne({ _id: user._id }, { $set: update });

      const refreshedUser = await User.findById(user._id).select("+passwordHash");

      if (!refreshedUser) {
        throw new Error(`Could not reload user ${params.email}`);
      }

      user = refreshedUser as typeof user;
    }

    console.log(`↷ Reusing ${params.role}: ${params.email}`);
  }

  return user;
}

async function getAccounts() {
  const organizationAdmin =
    (await User.findOne({ email: ORG_ADMIN_EMAIL.toLowerCase() })) ||
    (await User.findOne({ role: UserRole.ORGANIZATION_ADMIN }));

  if (!organizationAdmin?.organizationId) {
    throw new Error(
      "Could not find an Organization Admin with an organizationId. Log in once with your Organization Admin account or run the base seed first.",
    );
  }

  const organization = await Organization.findById(organizationAdmin.organizationId);
  if (!organization) throw new Error("Organization Admin's organization was not found");

  const platformAdmin =
    (await User.findOne({ email: PLATFORM_ADMIN_EMAIL.toLowerCase() })) ||
    (await User.findOne({ role: UserRole.PLATFORM_ADMIN }));

  if (!platformAdmin) {
    throw new Error("Platform Admin account was not found. Run the base seed first.");
  }

  let staff = await User.findOne({
    email: STAFF_EMAIL.toLowerCase(),
    role: UserRole.STAFF,
  });

  if (!staff) {
    staff = await User.findOne({
      organizationId: organization._id,
      role: UserRole.STAFF,
      isActive: true,
    });
  }

  if (!staff) {
    staff = await findOrCreateUser({
      email: STAFF_EMAIL,
      password: STAFF_PASSWORD,
      firstName: "David",
      lastName: "Staff",
      role: UserRole.STAFF,
      organizationId: organization._id,
      jobTitle: "Frontend Developer",
      department: "Engineering",
    });
  } else if (!staff.organizationId || staff.organizationId.toString() !== organization._id.toString()) {
    await User.updateOne(
      { _id: staff._id },
      {
        $set: {
          organizationId: organization._id,
          jobTitle: staff.jobTitle || "Frontend Developer",
          department: staff.department || "Engineering",
        },
      },
    );
    staff = (await User.findById(staff._id))!;
  }

  const manager = await findOrCreateUser({
    email: MANAGER_EMAIL,
    password: MANAGER_PASSWORD,
    firstName: "Grace",
    lastName: "Manager",
    role: UserRole.MANAGER,
    organizationId: organization._id,
    jobTitle: "Engineering Manager",
    department: "Engineering",
  });

  await User.updateOne(
    { _id: staff._id },
    { $set: { managerId: manager._id } },
  );

  return {
    organization,
    platformAdmin,
    organizationAdmin,
    staff: (await User.findById(staff._id))!,
    manager,
  };
}

async function seedFramework(
  organizationId: Types.ObjectId,
  creatorId: Types.ObjectId,
) {
  let framework = await FrameworkVersion.findOne({
    organizationId,
    version: "1.0",
  });

  if (!framework) {
    framework = await FrameworkVersion.create({
      organizationId,
      name: "SkillForge Professional Competency Framework",
      version: "1.0",
      description:
        "Demo framework covering technical, functional, leadership and behavioural competencies for testing SkillForge workflows.",
      status: "ACTIVE",
      effectiveFrom: new Date(),
      createdBy: creatorId,
    });
    console.log(`✓ Created framework ${framework.name} v${framework.version}`);
  } else {
    console.log("↷ Reusing framework v1.0");
  }

  await FrameworkVersion.updateMany(
    { organizationId, _id: { $ne: framework._id }, status: "ACTIVE" },
    { $set: { status: "ARCHIVED", effectiveTo: new Date() } },
  );

  await Organization.collection.updateOne(
    { _id: organizationId },
    {
      $set: {
        frameworkVersionId: framework._id,
        isActive: true,
        departments: ["Engineering", "Product", "Operations", "People"],
        teams: [
          { name: "Frontend Engineering", department: "Engineering" },
          { name: "Backend Engineering", department: "Engineering" },
          { name: "Product Management", department: "Product" },
        ],
        skillLibrary: {
          mode: "FULL",
          skills: [],
          behaviouralFactors: [],
        },
      },
    },
  );

  return framework;
}

const SKILL_DEFINITIONS = [
  ["Frontend Development", "technical", "Ability to design and build responsive, maintainable web interfaces."],
  ["Backend Development", "technical", "Ability to design APIs, services and server-side systems."],
  ["Database Management", "technical", "Ability to model, query and maintain reliable application data."],
  ["Problem Solving", "functional", "Ability to analyse complex problems and produce practical solutions."],
  ["Communication", "soft", "Ability to communicate clearly with technical and non-technical stakeholders."],
  ["Leadership", "leadership", "Ability to guide people, decisions and delivery toward shared outcomes."],
] as const;

const CATEGORY_MAP: Record<string, "TECHNICAL" | "FUNCTIONAL" | "SOFT_SKILL" | "LEADERSHIP"> = {
  technical: "TECHNICAL",
  functional: "FUNCTIONAL",
  soft: "SOFT_SKILL",
  leadership: "LEADERSHIP",
};

async function seedSkills(frameworkId: Types.ObjectId, organizationId: Types.ObjectId) {
  const skills = [] as Array<{ doc: any; definition: (typeof SKILL_DEFINITIONS)[number] }>;

  for (const definition of SKILL_DEFINITIONS) {
    const [name, category, description] = definition;
    const slug = slugify(name);

    const skill = await Skill.findOneAndUpdate(
      { frameworkVersionId: frameworkId, slug },
      {
        $set: {
          organizationId,
          name,
          description,
          category: CATEGORY_MAP[category],
          isActive: true,
        },
        $setOnInsert: { frameworkVersionId: frameworkId, slug },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    skills.push({ doc: skill, definition });
  }

  const levelNames = [
    "Awareness",
    "Foundational",
    "Developing",
    "Capable",
    "Proficient",
    "Advanced",
    "Expert",
    "Strategic",
    "Authority",
    "Thought Leader",
  ];

  for (const { doc: skill } of skills) {
    for (let level = 1; level <= 10; level += 1) {
      await SkillLevel.findOneAndUpdate(
        { skillId: skill._id, level },
        {
          $set: {
            frameworkVersionId: frameworkId,
            name: levelNames[level - 1],
            description: `${levelNames[level - 1]} capability in ${skill.name}.`,
            behaviours: [
              `Demonstrates ${skill.name.toLowerCase()} capability appropriate to level ${level}.`,
              `Applies relevant practices with increasing independence and consistency.`,
            ],
          },
          $setOnInsert: { skillId: skill._id, level },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
    }
  }

  return skills.map(({ doc }) => doc);
}

const FACTOR_DEFINITIONS = [
  ["Collaboration", "Works effectively with others, builds trust and contributes to shared outcomes.", [
    "Listens to different perspectives.",
    "Shares information and context proactively.",
    "Resolves disagreements constructively.",
  ]],
  ["Adaptability", "Responds effectively to changing priorities, constraints and new information.", [
    "Adjusts plans when circumstances change.",
    "Learns new approaches quickly.",
    "Maintains delivery focus during uncertainty.",
  ]],
  ["Ownership", "Takes responsibility for outcomes and follows through on commitments.", [
    "Tracks commitments to completion.",
    "Raises risks early.",
    "Learns from mistakes and improves processes.",
  ]],
] as const;

async function seedBehaviouralFactors(frameworkId: Types.ObjectId, organizationId: Types.ObjectId) {
  const factors = [] as any[];

  for (const [name, description, indicators] of FACTOR_DEFINITIONS) {
    const factor = await BehaviouralFactor.findOneAndUpdate(
      { frameworkVersionId: frameworkId, slug: slugify(name) },
      {
        $set: {
          organizationId,
          name,
          description,
          indicators,
          isActive: true,
        },
        $setOnInsert: {
          frameworkVersionId: frameworkId,
          slug: slugify(name),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    factors.push(factor);
  }

  return factors;
}

async function seedEvidencePrompts(
  frameworkId: Types.ObjectId,
  organizationId: Types.ObjectId,
  skills: any[],
  factors: any[],
) {
  for (const skill of skills) {
    await EvidencePrompt.findOneAndUpdate(
      { frameworkVersionId: frameworkId, skillId: skill._id, prompt: { $regex: `^Describe a real example where you used ${skill.name}` } },
      {
        $set: {
          organizationId,
          prompt: `Describe a real example where you used ${skill.name} to solve a problem or deliver an outcome. What did you personally do, and what was the result?`,
          evidenceType: "PROJECT",
          minimumLevel: 1,
          maximumLevel: 10,
          guidance: "Use a concrete example, explain your contribution, decisions, and measurable or observable outcome.",
          isActive: true,
        },
        $setOnInsert: { frameworkVersionId: frameworkId, skillId: skill._id },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  }

  for (const factor of factors) {
    await EvidencePrompt.findOneAndUpdate(
      { frameworkVersionId: frameworkId, behaviouralFactorId: factor._id },
      {
        $set: {
          organizationId,
          prompt: `Describe a situation that demonstrates your ${factor.name.toLowerCase()} behaviour. What happened, how did you respond, and what did you learn?`,
          evidenceType: "BEHAVIOURAL",
          minimumLevel: 1,
          maximumLevel: 10,
          guidance: "Focus on your own actions and the observable outcome.",
          isActive: true,
        },
        $setOnInsert: { frameworkVersionId: frameworkId, behaviouralFactorId: factor._id },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  }
}

async function seedRoleProfiles(
  organizationId: Types.ObjectId,
  frameworkId: Types.ObjectId,
  creatorId: Types.ObjectId,
  skills: any[],
  factors: any[],
) {
  const frontendSkills = skills.map((skill) => ({
    skillId: skill._id,
    targetLevel: skill.name === "Frontend Development" ? 7 : skill.name === "Problem Solving" ? 6 : 4,
    weight: skill.name === "Frontend Development" ? 2 : 1,
  }));

  const frontendFactors = factors.map((factor) => ({
    behaviouralFactorId: factor._id,
    targetLevel: factor.name === "Ownership" ? 6 : 5,
    weight: 1,
  }));

  const juniorSkills = skills.map((skill) => ({
    skillId: skill._id,
    targetLevel: skill.name === "Frontend Development" ? 5 : 3,
    weight: skill.name === "Frontend Development" ? 2 : 1,
  }));

  const juniorFactors = factors.map((factor) => ({
    behaviouralFactorId: factor._id,
    targetLevel: 4,
    weight: 1,
  }));

  const definitions = [
    {
      name: "Frontend Engineer",
      slug: "frontend-engineer",
      description: "Builds accessible, responsive and maintainable web applications using modern frontend practices.",
      department: "Engineering",
      skills: frontendSkills,
      behaviouralFactors: frontendFactors,
    },
    {
      name: "Junior Frontend Engineer",
      slug: "junior-frontend-engineer",
      description: "Develops user interfaces with guidance while building core engineering and collaboration capability.",
      department: "Engineering",
      skills: juniorSkills,
      behaviouralFactors: juniorFactors,
    },
  ];

  const profiles = [] as any[];

  for (const definition of definitions) {
    const profile = await RoleProfile.findOneAndUpdate(
      { organizationId, slug: definition.slug },
      {
        $set: {
          frameworkVersionId: frameworkId,
          name: definition.name,
          description: definition.description,
          department: definition.department,
          status: RoleProfileStatus.PUBLISHED,
          skills: definition.skills,
          behaviouralFactors: definition.behaviouralFactors,
          createdBy: creatorId,
          updatedBy: creatorId,
          publishedAt: new Date(),
        },
        $setOnInsert: { organizationId, slug: definition.slug },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    profiles.push(profile);
  }

  return profiles;
}

async function seedLearningResources(
  organizationId: Types.ObjectId,
  creatorId: Types.ObjectId,
  skills: any[],
  factors: any[],
) {
  const resources = [
    {
      competencyType: "SKILL",
      competencyId: skills.find((x) => x.name === "Frontend Development")._id,
      title: "MDN Web Development Guide",
      description: "Reference material for HTML, CSS, JavaScript and browser APIs.",
      url: "https://developer.mozilla.org/en-US/docs/Learn",
      provider: "MDN",
      resourceType: "DOCUMENT",
      targetLevel: 5,
    },
    {
      competencyType: "SKILL",
      competencyId: skills.find((x) => x.name === "Backend Development")._id,
      title: "Node.js Learn",
      description: "Official learning resources for Node.js development.",
      url: "https://nodejs.org/en/learn",
      provider: "Node.js",
      resourceType: "COURSE",
      targetLevel: 5,
    },
    {
      competencyType: "SKILL",
      competencyId: skills.find((x) => x.name === "Problem Solving")._id,
      title: "Problem Solving Practice",
      description: "Practice structured problem solving through coding challenges.",
      url: "https://leetcode.com/problemset/",
      provider: "LeetCode",
      resourceType: "OTHER",
      targetLevel: 6,
    },
    {
      competencyType: "BEHAVIOURAL_FACTOR",
      competencyId: factors.find((x) => x.name === "Collaboration")._id,
      title: "Effective Communication at Work",
      description: "Practical guidance for clear workplace communication.",
      url: "https://www.atlassian.com/blog/leadership/communication",
      provider: "Atlassian",
      resourceType: "ARTICLE",
      targetLevel: 5,
    },
  ];

  for (const resource of resources) {
    await LearningResource.findOneAndUpdate(
      { organizationId, title: resource.title },
      { $set: { ...resource, organizationId, createdBy: creatorId, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
}

async function seedCareerPath(
  organizationId: Types.ObjectId,
  creatorId: Types.ObjectId,
  source: any,
  target: any,
) {
  const skillDeltas = target.skills.map((targetSkill: any) => {
    const sourceSkill = source.skills.find((item: any) => item.skillId.toString() === targetSkill.skillId.toString());
    const sourceLevel = sourceSkill?.targetLevel;
    const delta = targetSkill.targetLevel - (sourceLevel || 0);
    return {
      skillId: targetSkill.skillId,
      sourceLevel,
      targetLevel: targetSkill.targetLevel,
      delta,
      changeType: delta > 0 ? CareerPathChangeType.INCREASED : delta < 0 ? CareerPathChangeType.DECREASED : CareerPathChangeType.UNCHANGED,
    };
  });

  const behaviouralFactorDeltas = target.behaviouralFactors.map((targetFactor: any) => {
    const sourceFactor = source.behaviouralFactors.find((item: any) => item.behaviouralFactorId.toString() === targetFactor.behaviouralFactorId.toString());
    const sourceLevel = sourceFactor?.targetLevel;
    const delta = targetFactor.targetLevel - (sourceLevel || 0);
    return {
      behaviouralFactorId: targetFactor.behaviouralFactorId,
      sourceLevel,
      targetLevel: targetFactor.targetLevel,
      delta,
      changeType: delta > 0 ? CareerPathChangeType.INCREASED : delta < 0 ? CareerPathChangeType.DECREASED : CareerPathChangeType.UNCHANGED,
    };
  });

  return CareerPath.findOneAndUpdate(
    {
      organizationId,
      sourceRoleProfileId: source._id,
      targetRoleProfileId: target._id,
    },
    {
      $set: {
        name: "Junior Frontend Engineer → Frontend Engineer",
        description: "Example career path showing the competency deltas required for progression.",
        skillDeltas,
        behaviouralFactorDeltas,
        createdBy: creatorId,
        updatedBy: creatorId,
      },
      $setOnInsert: {
        organizationId,
        sourceRoleProfileId: source._id,
        targetRoleProfileId: target._id,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

async function seedIndustryTemplate(
  frameworkSkills: any[],
  frameworkFactors: any[],
) {
  const template = await IndustryTemplate.findOneAndUpdate(
    { slug: "technology-engineering" },
    {
      $set: {
        name: "Technology Engineering",
        description: "Demo industry template for technology and engineering roles.",
        industry: "Technology",
        skills: frameworkSkills.map((skill) => ({ skillId: skill._id, weight: skill.name === "Frontend Development" ? 2 : 1 })),
        behaviouralFactors: frameworkFactors.map((factor) => ({ behaviouralFactorId: factor._id, weight: 1 })),
        isSystemTemplate: true,
        isActive: true,
      },
      $setOnInsert: { slug: "technology-engineering" },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return template;
}

async function seedObjectiveAssessment(
  organizationId: Types.ObjectId,
  frameworkId: Types.ObjectId,
  creatorId: Types.ObjectId,
  roleProfile: any,
  staffId: Types.ObjectId,
) {
  const assessment = await Assessment.findOneAndUpdate(
    { organizationId, slug: "frontend-engineering-core-assessment" },
    {
      $set: {
        frameworkVersionId: frameworkId,
        title: "Frontend Engineering Core Assessment",
        description: "Demo objective assessment for testing question delivery, attempts and scoring.",
        type: AssessmentType.TECHNICAL,
        status: AssessmentStatus.PUBLISHED,
        instructions: "Answer every required question. This assessment is seeded for SkillForge testing.",
        durationMinutes: 30,
        passingScore: 60,
        maxAttempts: 1,
        randomizeQuestions: false,
        randomizeOptions: false,
        showResultsImmediately: true,
        createdBy: creatorId,
        updatedBy: creatorId,
        publishedAt: new Date(),
      },
      $setOnInsert: { organizationId, slug: "frontend-engineering-core-assessment" },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  const section = await AssessmentSection.findOneAndUpdate(
    { assessmentId: assessment._id, order: 1 },
    {
      $set: {
        title: "Frontend Fundamentals",
        description: "Core frontend engineering concepts and practical reasoning.",
        instructions: "Choose the answer that best represents the correct engineering approach.",
      },
      $setOnInsert: { assessmentId: assessment._id, order: 1 },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  const frontendSkill = await Skill.findOne({
    frameworkVersionId: frameworkId,
    slug: "frontend-development",
  });
  const problemSolvingSkill = await Skill.findOne({
    frameworkVersionId: frameworkId,
    slug: "problem-solving",
  });

  if (!frontendSkill || !problemSolvingSkill) throw new Error("Seed skills missing for objective assessment");

  const questions = [
    {
      order: 1,
      skillId: frontendSkill._id,
      type: AssessmentQuestionType.SINGLE_CHOICE,
      difficulty: QuestionDifficulty.MEDIUM,
      level: 4,
      question: "Which approach best improves the accessibility of a form field?",
      options: [
        { key: "A", text: "Use a visible label associated with the input", score: 1, isCorrect: true },
        { key: "B", text: "Use placeholder text as the only label", score: 0, isCorrect: false },
        { key: "C", text: "Hide the field from screen readers", score: 0, isCorrect: false },
        { key: "D", text: "Use a larger border only", score: 0, isCorrect: false },
      ],
      explanation: "A properly associated visible label gives the field an accessible name and remains available while the user interacts with it.",
      guidance: "Look for semantic accessibility practices rather than purely visual styling.",
    },
    {
      order: 2,
      skillId: frontendSkill._id,
      type: AssessmentQuestionType.SINGLE_CHOICE,
      difficulty: QuestionDifficulty.MEDIUM,
      level: 5,
      question: "What is the most appropriate reason to split a large React component into smaller components?",
      options: [
        { key: "A", text: "To improve separation of concerns and maintainability", score: 1, isCorrect: true },
        { key: "B", text: "To guarantee fewer network requests", score: 0, isCorrect: false },
        { key: "C", text: "To remove the need for state management", score: 0, isCorrect: false },
        { key: "D", text: "To make every component use global state", score: 0, isCorrect: false },
      ],
      explanation: "Smaller components can isolate responsibilities and make code easier to test, reuse and maintain.",
      guidance: "Evaluate architecture and maintainability.",
    },
    {
      order: 3,
      skillId: problemSolvingSkill._id,
      type: AssessmentQuestionType.SCENARIO,
      difficulty: QuestionDifficulty.HARD,
      level: 6,
      question: "A production page suddenly becomes slow after a new feature is released. How would you investigate the issue?",
      scenario: "Users report that a page that previously loaded quickly now takes several seconds to become interactive.",
      options: [],
      explanation: "A strong response should describe a structured investigation using browser performance tools, network analysis, profiling, recent changes and measurement before remediation.",
      guidance: "Look for evidence-based diagnosis rather than immediately changing code without measurement.",
    },
    {
      order: 4,
      skillId: frontendSkill._id,
      type: AssessmentQuestionType.TRUE_FALSE,
      difficulty: QuestionDifficulty.EASY,
      level: 3,
      question: "Semantic HTML elements can improve accessibility and document structure.",
      options: [
        { key: "A", text: "True", score: 1, isCorrect: true },
        { key: "B", text: "False", score: 0, isCorrect: false },
      ],
      explanation: "Semantic HTML communicates structure and meaning to browsers and assistive technologies.",
      guidance: "Assess foundational accessibility knowledge.",
    },
  ];

  for (const item of questions) {
    await AssessmentQuestion.findOneAndUpdate(
      { assessmentId: assessment._id, order: item.order },
      {
        $set: {
          sectionId: section._id,
          frameworkVersionId: frameworkId,
          skillId: item.skillId,
          behaviouralFactorId: undefined,
          question: item.question,
          scenario: item.scenario,
          type: item.type,
          difficulty: item.difficulty,
          level: item.level,
          options: item.options,
          explanation: item.explanation,
          guidance: item.guidance,
          weight: 1,
          isRequired: true,
        },
        $setOnInsert: { assessmentId: assessment._id, order: item.order },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  }

  await AssessmentAssignment.findOneAndUpdate(
    { assessmentId: assessment._id, candidateId: staffId },
    {
      $set: {
        organizationId,
        assignedBy: creatorId,
        status: AssessmentAssignmentStatus.ASSIGNED,
        assignedAt: new Date(),
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxAttempts: 1,
        instructions: "Complete the seeded Frontend Engineering Core Assessment.",
      },
      $setOnInsert: { assessmentId: assessment._id, candidateId: staffId },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return assessment;
}

async function seedSelfAssessmentCampaign(
  organizationId: Types.ObjectId,
  creatorId: Types.ObjectId,
  staffId: Types.ObjectId,
  managerId: Types.ObjectId,
  roleProfile: any,
) {
  const existing = await SelfAssessmentCampaign.findOne({
    organizationId,
    name: "Demo Frontend Engineer Self-Assessment",
  });

  if (existing) {
    console.log(`↷ Reusing self-assessment campaign (${existing.status})`);
    return existing;
  }

  const campaign = await createCampaign({
    organizationId: organizationId.toString(),
    createdBy: creatorId.toString(),
    name: "Demo Frontend Engineer Self-Assessment",
    description: "Seeded campaign for testing the staff self-assessment and manager corroboration workflows.",
    roleProfileId: roleProfile._id.toString(),
    scope: SelfAssessmentCampaignScope.INDIVIDUAL,
    candidateIds: [staffId.toString()],
    startAt: new Date(Date.now() - 60 * 60 * 1000),
    dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    corroborationRequired: true,
  });

  await launchCampaign(
    campaign._id.toString(),
    organizationId.toString(),
    creatorId.toString(),
  );

  const launched = await SelfAssessmentCampaign.findById(campaign._id);
  if (!launched || launched.status !== SelfAssessmentCampaignStatus.LAUNCHED) {
    throw new Error("Seed campaign could not be launched");
  }

  console.log("✓ Created and launched self-assessment campaign");
  return launched;
}

async function seedNotifications(
  organizationId: Types.ObjectId,
  staffId: Types.ObjectId,
  managerId: Types.ObjectId,
) {
  const notifications = [
    {
      recipientId: staffId,
      type: NotificationType.SYSTEM,
      priority: NotificationPriority.NORMAL,
      title: "Welcome to the SkillForge demo workspace",
      message: "Your demo competency framework, role profile and assessments are ready to explore.",
    },
    {
      recipientId: managerId,
      type: NotificationType.SYSTEM,
      priority: NotificationPriority.NORMAL,
      title: "Demo manager workspace ready",
      message: "A seeded staff member has been assigned to you for corroboration testing.",
    },
  ];

  for (const item of notifications) {
    await Notification.findOneAndUpdate(
      {
        organizationId,
        recipientId: item.recipientId,
        title: item.title,
      },
      {
        $set: {
          organizationId,
          recipientId: item.recipientId,
          type: item.type,
          priority: item.priority,
          title: item.title,
          message: item.message,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
}

async function main() {
  console.log("\nSkillForge demo-content seed\n");
  console.log("Connecting to MongoDB...");
  await mongoose.connect(env.mongodbUri);

  try {
    const { organization, platformAdmin, organizationAdmin, staff, manager } = await getAccounts();

    console.log(`Organization: ${organization.name} (${organization._id})`);
    console.log(`Staff: ${staff.email} (${staff._id})`);
    console.log(`Manager: ${manager.email} (${manager._id})`);

    const framework = await seedFramework(
      organization._id as Types.ObjectId,
      platformAdmin._id as Types.ObjectId,
    );

    const skills = await seedSkills(
      framework._id as Types.ObjectId,
      organization._id as Types.ObjectId,
    );

    const factors = await seedBehaviouralFactors(
      framework._id as Types.ObjectId,
      organization._id as Types.ObjectId,
    );

    await seedEvidencePrompts(
      framework._id as Types.ObjectId,
      organization._id as Types.ObjectId,
      skills,
      factors,
    );

    const roleProfiles = await seedRoleProfiles(
      organization._id as Types.ObjectId,
      framework._id as Types.ObjectId,
      organizationAdmin._id as Types.ObjectId,
      skills,
      factors,
    );

    await seedIndustryTemplate(skills, factors);

    await seedLearningResources(
      organization._id as Types.ObjectId,
      organizationAdmin._id as Types.ObjectId,
      skills,
      factors,
    );

    await seedCareerPath(
      organization._id as Types.ObjectId,
      organizationAdmin._id as Types.ObjectId,
      roleProfiles.find((p) => p.slug === "junior-frontend-engineer"),
      roleProfiles.find((p) => p.slug === "frontend-engineer"),
    );

    const objectiveAssessment = await seedObjectiveAssessment(
      organization._id as Types.ObjectId,
      framework._id as Types.ObjectId,
      organizationAdmin._id as Types.ObjectId,
      roleProfiles.find((p) => p.slug === "frontend-engineer"),
      staff._id as Types.ObjectId,
    );

    const campaign = await seedSelfAssessmentCampaign(
      organization._id as Types.ObjectId,
      organizationAdmin._id as Types.ObjectId,
      staff._id as Types.ObjectId,
      manager._id as Types.ObjectId,
      roleProfiles.find((p) => p.slug === "frontend-engineer"),
    );

    await seedNotifications(
      organization._id as Types.ObjectId,
      staff._id as Types.ObjectId,
      manager._id as Types.ObjectId,
    );

    console.log("\n========================================");
    console.log("SKILLFORGE DEMO DATA READY");
    console.log("========================================");
    console.log(`Organization: ${organization.name}`);
    console.log(`Framework: ${framework.name} v${framework.version}`);
    console.log(`Skills: ${skills.length}`);
    console.log(`Behavioural factors: ${factors.length}`);
    console.log(`Role profiles: ${roleProfiles.length}`);
    console.log(`Objective assessment: ${objectiveAssessment.title}`);
    console.log(`Self-assessment campaign: ${campaign.name}`);
    console.log("\nTEST ACCOUNTS");
    console.log(`Staff:   ${staff.email} / password already configured on your account`);
    console.log(`Manager: ${MANAGER_EMAIL} / ${MANAGER_PASSWORD}`);
    console.log(`Org Admin: ${organizationAdmin.email}`);
    console.log(`Platform Admin: ${platformAdmin.email}`);
    console.log("\nThe seeded staff account has been assigned to the seeded manager.");
    console.log("The self-assessment campaign is already launched and requires corroboration.");
    console.log("The objective assessment is published and assigned to the staff account.");
    console.log("\nDone.\n");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("\nSeed failed:", error);
  process.exitCode = 1;
});
