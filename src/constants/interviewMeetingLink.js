export const MEETING_LINK_NOTICE_MINUTES = 30;
export const MEETING_LINK_POST_END_GRACE_MINUTES = 30;

export const getMeetingLinkLeadWindowText = (minutes = MEETING_LINK_NOTICE_MINUTES) => (
  `${minutes} minutes before start`
);

export const getCandidateMeetingLinkEmailNotice = (minutes = MEETING_LINK_NOTICE_MINUTES) => (
  `Join link is emailed ${getMeetingLinkLeadWindowText(minutes)}`
);

export const getRecruiterMeetingLinkScheduledDescription = (minutes = MEETING_LINK_NOTICE_MINUTES) => (
  `Secure join link is generated automatically and emailed to the candidate ${getMeetingLinkLeadWindowText(minutes)}.`
);

export const getRecruiterMeetingLinkUnscheduledDescription = (minutes = MEETING_LINK_NOTICE_MINUTES) => (
  `Once you schedule the interview, a secure join link is generated automatically and emailed to the candidate ${getMeetingLinkLeadWindowText(minutes)}.`
);

export const getRecruiterMeetingLinkRescheduleDescription = () => (
  'If you reschedule the interview, the previous join link is invalidated automatically and replaced with a new one for the updated slot.'
);
