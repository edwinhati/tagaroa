import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@repo/ui";

const items = [
  {
    name: "team",
    choices: [
      { value: "supply-chain" },
      { value: "engineering" },
      { value: "finance" },
    ],
  },
  {
    name: "systems",
    choices: [
      { value: "directory" },
      { value: "audit-log" },
      { value: "notifications" },
    ],
  },
  { name: "email" },
] as const;

export const TeamChoice = () => (
  <Questionnaire items={items} defaultItem="team" className="max-w-lg">
    <QuestionnaireProgress />
    <QuestionnaireItem name="team">
      <QuestionnaireTitle>Which team are you joining?</QuestionnaireTitle>
      <QuestionnaireDescription>
        This determines which workspace domains you see by default.
      </QuestionnaireDescription>
      <QuestionnaireChoices>
        <QuestionnaireChoice value="supply-chain" defaultChecked>
          Supply chain
          <QuestionnaireChoiceDescription>
            Purchase orders, suppliers, inventory
          </QuestionnaireChoiceDescription>
        </QuestionnaireChoice>
        <QuestionnaireChoice value="engineering">
          Engineering
          <QuestionnaireChoiceDescription>
            Services, deploys, on-call
          </QuestionnaireChoiceDescription>
        </QuestionnaireChoice>
        <QuestionnaireChoice value="finance">
          Finance
          <QuestionnaireChoiceDescription>
            Invoices, budgets, approvals
          </QuestionnaireChoiceDescription>
        </QuestionnaireChoice>
      </QuestionnaireChoices>
    </QuestionnaireItem>
    <QuestionnaireActions>
      <QuestionnaireSkip />
      <QuestionnaireNext />
    </QuestionnaireActions>
  </Questionnaire>
);

export const SystemsMultiple = () => (
  <Questionnaire items={items} defaultItem="systems" className="max-w-lg">
    <QuestionnaireProgress />
    <QuestionnaireItem name="systems" multiple>
      <QuestionnaireTitle>
        Which systems do you need access to?
      </QuestionnaireTitle>
      <QuestionnaireDescription>
        Select every system that applies.
      </QuestionnaireDescription>
      <QuestionnaireChoices>
        <QuestionnaireChoice value="directory" defaultChecked>
          Directory
        </QuestionnaireChoice>
        <QuestionnaireChoice value="audit-log" defaultChecked>
          Audit log
        </QuestionnaireChoice>
        <QuestionnaireChoice value="notifications">
          Notifications console
        </QuestionnaireChoice>
      </QuestionnaireChoices>
    </QuestionnaireItem>
    <QuestionnaireActions>
      <QuestionnairePrevious />
      <QuestionnaireSkip />
      <QuestionnaireNext />
    </QuestionnaireActions>
  </Questionnaire>
);

export const EmailInput = () => (
  <Questionnaire items={items} defaultItem="email" className="max-w-lg">
    <QuestionnaireProgress />
    <QuestionnaireItem name="email" invalid>
      <QuestionnaireTitle>Work email</QuestionnaireTitle>
      <QuestionnaireDescription>
        We'll send your access confirmation here.
      </QuestionnaireDescription>
      <QuestionnaireInput type="email" defaultValue="not-an-email" />
      <QuestionnaireError>Enter a valid work email address.</QuestionnaireError>
    </QuestionnaireItem>
    <QuestionnaireActions>
      <QuestionnairePrevious />
      <QuestionnaireSubmit />
    </QuestionnaireActions>
  </Questionnaire>
);
