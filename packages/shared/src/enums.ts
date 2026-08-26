export enum NodeType { Start='start', Approval='approval', Handle='handle', Condition='condition', Cc='cc', End='end' }
export enum ApprovalMethod { Countersign='countersign', Orsign='orsign' }
export enum AssigneeType { Person='person', Role='role', Supervisor='supervisor', InitiatorChoice='initiator_choice' }
export enum TimeoutAction { Remind='remind', AutoApprove='auto_approve', AutoReject='auto_reject' }
export enum DocumentStatus { Draft='draft', InApproval='in_approval', Rejected='rejected', Archived='archived' }
export enum InstanceStatus { Running='running', Approved='approved', Rejected='rejected', Withdrawn='withdrawn' }
export enum TaskStatus { Pending='pending', Approved='approved', Rejected='rejected', Transferred='transferred', Cc='cc', Voided='voided' }
export enum UserStatus { Active='active', Disabled='disabled', Pending='pending' }
export enum RecordAction { Approve='approve', Reject='reject', Transfer='transfer', Remind='remind', Withdraw='withdraw', Cc='cc', Timeout='timeout' }
export enum WorkflowStatus { Draft='draft', Active='active', Disabled='disabled' }