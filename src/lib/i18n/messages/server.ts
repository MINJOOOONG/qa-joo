import { defineMessages } from "../define";

/** Success messages returned by server actions. Errors are translated by ../server-messages.ts. */
export const server = defineMessages({
  en: {
    projectSaved: "Project saved.",
    sectionAdded: "Section added.",
    approvedCases: "Approved {count} case(s).",
    rejectedCases: "Rejected {count} case(s).",
    nothingToReject: "Nothing to reject.",
    addedToRun: "Added to the run.",
    alreadyInRun: "Already part of the run.",
    automationDraftSaved: "Draft saved. Approve it to make the case Automated.",
    automationApproved: "Approved. The case is now Automated.",
    automationRejected: "Draft rejected.",
    automationRunCancelled: "Run cancelled.",
    suggestedCasesAdded: "Added {count} AI draft case(s) for review.",
  },
  ko: {
    projectSaved: "프로젝트를 저장했습니다.",
    sectionAdded: "섹션을 추가했습니다.",
    approvedCases: "케이스 {count}개를 승인했습니다.",
    rejectedCases: "케이스 {count}개를 반려했습니다.",
    nothingToReject: "반려할 케이스가 없습니다.",
    addedToRun: "실행에 추가했습니다.",
    alreadyInRun: "이미 실행에 포함되어 있습니다.",
    automationDraftSaved: "초안을 저장했습니다. 승인하면 케이스가 자동화됨 상태가 됩니다.",
    automationApproved: "승인했습니다. 이제 케이스가 자동화됨 상태입니다.",
    automationRejected: "초안을 반려했습니다.",
    automationRunCancelled: "실행을 취소했습니다.",
    suggestedCasesAdded: "검토할 AI 초안 케이스 {count}개를 추가했습니다.",
  },
});
