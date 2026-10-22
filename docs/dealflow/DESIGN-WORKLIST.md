# Design worklist (Part 11)

Baseline from `pnpm check:design --json /tmp/design-baseline.json` on 2026-10-22, at Phase 0 base commit
`18e1dff`. The final state (0 violations, every opt-out listed) is written in Task 3.4.

## Baseline totals

- Total: **289 violations in 184 files**.
- Opt-outs: **0** (the limit is 40).

| Rule | Violations |
|---|---:|
| `palette` | 88 |
| `page-title` | 75 |
| `uppercase` | 52 |
| `shadow` | 39 |
| `font-size` | 31 |
| `raw-colour` | 4 |

## Violations per task

| Task | Violations |
|---|---:|
| 0.3 | 4 |
| 1.1 | 19 |
| 1.2 | 28 |
| 1.3 | 11 |
| 1.4 | 49 |
| 2.1 | 19 |
| 2.2 | 9 |
| 2.3 | 8 |
| 2.4 | 14 |
| 2.5 | 5 |
| 3.1 | 116 |
| 3.2 | 3 |
| 3.4 | 4 |

## Files (sorted by violation count)

The Task column maps each file to its section 8 task; files with no clear owner go to Task 3.4.

| # | File | Violations | Rules | Task |
|---:|---|---:|---|---|
| 1 | `src/features/deals/DealCard.tsx` | 12 | raw-colour 3, palette 4, shadow 3, font-size 1, uppercase 1 | 1.2 |
| 2 | `src/features/insights/ui/ReportConfigPanel.tsx` | 6 | uppercase 6 | 2.4 |
| 3 | `src/components/shell/LeftNav.tsx` | 5 | palette 5 | 1.1 |
| 4 | `src/app/(app)/settings/ai/AiSettingsClient.tsx` | 4 | shadow 4 | 3.1 |
| 5 | `src/app/(app)/settings/permission-sets/FlagEditor.tsx` | 4 | shadow 1, uppercase 2, palette 1 | 3.1 |
| 6 | `src/app/(app)/settings/users/InviteUserForm.tsx` | 4 | shadow 1, palette 3 | 3.1 |
| 7 | `src/app/(app)/settings/company/activities/ActivityTypesClient.tsx` | 3 | shadow 2, palette 1 | 3.1 |
| 8 | `src/app/(app)/settings/import/new/page.tsx` | 3 | palette 2, page-title 1 | 3.1 |
| 9 | `src/app/(app)/settings/import/page.tsx` | 3 | palette 2, page-title 1 | 3.1 |
| 10 | `src/app/(app)/settings/import/PreviewStep.tsx` | 3 | palette 3 | 3.1 |
| 11 | `src/app/(app)/settings/SettingsNav.tsx` | 3 | uppercase 2, font-size 1 | 3.1 |
| 12 | `src/features/activities/ActivityDatePicker.tsx` | 3 | palette 3 | 1.4 |
| 13 | `src/features/ai/ui/DealAiCard.tsx` | 3 | uppercase 2, shadow 1 | 1.3 |
| 14 | `src/features/deals/DragDropZones.tsx` | 3 | palette 2, uppercase 1 | 1.2 |
| 15 | `src/features/documents/ui/DocumentView.tsx` | 3 | uppercase 3 | 2.3 |
| 16 | `src/features/email/ThreadLabelChips.tsx` | 3 | uppercase 2, font-size 1 | 2.1 |
| 17 | `src/features/entity-create/EntityCombobox.tsx` | 3 | shadow 1, font-size 1, palette 1 | 3.4 |
| 18 | `src/features/leads/inbox/LeadsTable.tsx` | 3 | font-size 1, uppercase 2 | 1.4 |
| 19 | `src/features/notifications/ui/NotificationsBell.tsx` | 3 | palette 1, uppercase 2 | 1.1 |
| 20 | `src/features/projects/ui/TaskCard.tsx` | 3 | shadow 2, font-size 1 | 2.5 |
| 21 | `src/app/(app)/activities/calendar/calendarChip.tsx` | 2 | font-size 1, palette 1 | 2.2 |
| 22 | `src/app/(app)/contacts/timeline/EngagementTimelineClient.tsx` | 2 | palette 1, shadow 1 | 1.4 |
| 23 | `src/app/(app)/settings/company/activities/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 24 | `src/app/(app)/settings/company/labels/LabelsClient.tsx` | 2 | palette 1, shadow 1 | 3.1 |
| 25 | `src/app/(app)/settings/company/labels/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 26 | `src/app/(app)/settings/company/lost-reasons/LostReasonsClient.tsx` | 2 | shadow 2 | 3.1 |
| 27 | `src/app/(app)/settings/company/lost-reasons/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 28 | `src/app/(app)/settings/company/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 29 | `src/app/(app)/settings/company/pipelines/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 30 | `src/app/(app)/settings/connections/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 31 | `src/app/(app)/settings/currencies/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 32 | `src/app/(app)/settings/email-sync/EmailSyncClient.tsx` | 2 | palette 2 | 3.1 |
| 33 | `src/app/(app)/settings/email-sync/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 34 | `src/app/(app)/settings/enrichment/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 35 | `src/app/(app)/settings/fields/DataFieldsClient.tsx` | 2 | shadow 1, palette 1 | 3.1 |
| 36 | `src/app/(app)/settings/fields/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 37 | `src/app/(app)/settings/goals/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 38 | `src/app/(app)/settings/import/MapStep.tsx` | 2 | uppercase 1, palette 1 | 3.1 |
| 39 | `src/app/(app)/settings/permission-sets/CreatePermissionSetForm.tsx` | 2 | shadow 1, palette 1 | 3.1 |
| 40 | `src/app/(app)/settings/permission-sets/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 41 | `src/app/(app)/settings/products/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 42 | `src/app/(app)/settings/profile/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 43 | `src/app/(app)/settings/teams/[teamId]/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 44 | `src/app/(app)/settings/teams/[teamId]/TeamEditClient.tsx` | 2 | palette 2 | 3.1 |
| 45 | `src/app/(app)/settings/teams/CreateTeamForm.tsx` | 2 | shadow 1, palette 1 | 3.1 |
| 46 | `src/app/(app)/settings/teams/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 47 | `src/app/(app)/settings/users/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 48 | `src/app/(app)/settings/visibility-groups/[groupId]/GroupMembersClient.tsx` | 2 | palette 2 | 3.1 |
| 49 | `src/app/(app)/settings/visibility-groups/[groupId]/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 50 | `src/app/(app)/settings/visibility-groups/CreateGroupForm.tsx` | 2 | shadow 1, palette 1 | 3.1 |
| 51 | `src/app/(app)/settings/visibility-groups/page.tsx` | 2 | palette 1, page-title 1 | 3.1 |
| 52 | `src/components/data-table/ColumnsMenu.tsx` | 2 | uppercase 2 | 1.4 |
| 53 | `src/components/ui/Combobox.tsx` | 2 | font-size 2 | 0.3 |
| 54 | `src/components/ui/MultiCombobox.tsx` | 2 | font-size 2 | 0.3 |
| 55 | `src/features/activities/ActivityEditModal.tsx` | 2 | palette 2 | 1.4 |
| 56 | `src/features/automations/ui/AutomationEditor.tsx` | 2 | uppercase 2 | 3.1 |
| 57 | `src/features/compose/SharedComposeBar.tsx` | 2 | shadow 1, raw-colour 1 | 2.1 |
| 58 | `src/features/contacts/OrgsList.tsx` | 2 | shadow 1, palette 1 | 1.4 |
| 59 | `src/features/contacts/PeopleList.tsx` | 2 | shadow 1, palette 1 | 1.4 |
| 60 | `src/features/deal-workspace/composer/FreeBusyIndicator.tsx` | 2 | palette 2 | 1.3 |
| 61 | `src/features/deals/CreateFilterModal.tsx` | 2 | palette 2 | 1.2 |
| 62 | `src/features/deals/DealList.tsx` | 2 | shadow 2 | 1.4 |
| 63 | `src/features/email/InboxReaderSidebar.tsx` | 2 | uppercase 1, font-size 1 | 2.1 |
| 64 | `src/features/email/SidebarLinkPanel.tsx` | 2 | uppercase 2 | 2.1 |
| 65 | `src/features/navigation/mobile/BottomNav.tsx` | 2 | font-size 2 | 1.1 |
| 66 | `src/features/notifications/ui/NotificationItem.tsx` | 2 | palette 2 | 1.1 |
| 67 | `src/features/products/ui/DealProductsSection.tsx` | 2 | font-size 1, uppercase 1 | 1.3 |
| 68 | `src/features/search/ui/CommandPalette.tsx` | 2 | uppercase 2 | 1.1 |
| 69 | `src/app/(app)/activities/@modal/(..)contacts/orgs/[orgId]/page.tsx` | 1 | page-title 1 | 1.4 |
| 70 | `src/app/(app)/activities/@modal/(..)contacts/people/[personId]/page.tsx` | 1 | page-title 1 | 1.4 |
| 71 | `src/app/(app)/activities/@modal/(..)deals/[dealId]/page.tsx` | 1 | page-title 1 | 1.4 |
| 72 | `src/app/(app)/activities/@modal/(..)leads/[leadId]/page.tsx` | 1 | page-title 1 | 1.4 |
| 73 | `src/app/(app)/activities/calendar/calendarDrag.tsx` | 1 | shadow 1 | 2.2 |
| 74 | `src/app/(app)/activities/calendar/MoreActivitiesChip.tsx` | 1 | font-size 1 | 2.2 |
| 75 | `src/app/(app)/activities/calendar/page.tsx` | 1 | page-title 1 | 2.2 |
| 76 | `src/app/(app)/activities/calendar/TimeGutter.tsx` | 1 | font-size 1 | 2.2 |
| 77 | `src/app/(app)/activities/calendar/WeekAgendaGrid.tsx` | 1 | font-size 1 | 2.2 |
| 78 | `src/app/(app)/activities/list/page.tsx` | 1 | page-title 1 | 1.4 |
| 79 | `src/app/(app)/activities/page.tsx` | 1 | page-title 1 | 1.4 |
| 80 | `src/app/(app)/contacts/contactDetail.shared.tsx` | 1 | palette 1 | 1.4 |
| 81 | `src/app/(app)/contacts/duplicates/page.tsx` | 1 | page-title 1 | 1.4 |
| 82 | `src/app/(app)/contacts/orgs/[orgId]/page.tsx` | 1 | page-title 1 | 1.4 |
| 83 | `src/app/(app)/contacts/orgs/[orgId]/RelatedOrgsPanel.tsx` | 1 | palette 1 | 1.4 |
| 84 | `src/app/(app)/contacts/orgs/@modal/(..)orgs/[orgId]/page.tsx` | 1 | page-title 1 | 1.4 |
| 85 | `src/app/(app)/contacts/orgs/page.tsx` | 1 | page-title 1 | 1.4 |
| 86 | `src/app/(app)/contacts/people/[personId]/page.tsx` | 1 | page-title 1 | 1.4 |
| 87 | `src/app/(app)/contacts/people/@modal/(..)people/[personId]/page.tsx` | 1 | page-title 1 | 1.4 |
| 88 | `src/app/(app)/contacts/people/page.tsx` | 1 | page-title 1 | 1.4 |
| 89 | `src/app/(app)/contacts/timeline/page.tsx` | 1 | page-title 1 | 1.4 |
| 90 | `src/app/(app)/dashboard/page.tsx` | 1 | page-title 1 | 2.4 |
| 91 | `src/app/(app)/deals/[dealId]/page.tsx` | 1 | page-title 1 | 1.3 |
| 92 | `src/app/(app)/deals/page.tsx` | 1 | page-title 1 | 1.4 |
| 93 | `src/app/(app)/documents/[id]/page.tsx` | 1 | page-title 1 | 2.3 |
| 94 | `src/app/(app)/documents/[id]/print/page.tsx` | 1 | page-title 1 | 2.3 |
| 95 | `src/app/(app)/documents/page.tsx` | 1 | page-title 1 | 2.3 |
| 96 | `src/app/(app)/forecast/page.tsx` | 1 | page-title 1 | 2.2 |
| 97 | `src/app/(app)/inbox/[threadId]/page.tsx` | 1 | page-title 1 | 2.1 |
| 98 | `src/app/(app)/inbox/compose/page.tsx` | 1 | page-title 1 | 2.1 |
| 99 | `src/app/(app)/inbox/page.tsx` | 1 | page-title 1 | 2.1 |
| 100 | `src/app/(app)/insights/dashboards/[id]/page.tsx` | 1 | page-title 1 | 2.4 |
| 101 | `src/app/(app)/insights/page.tsx` | 1 | page-title 1 | 2.4 |
| 102 | `src/app/(app)/insights/reports/[id]/page.tsx` | 1 | page-title 1 | 2.4 |
| 103 | `src/app/(app)/leads/[leadId]/page.tsx` | 1 | page-title 1 | 1.4 |
| 104 | `src/app/(app)/leads/@modal/(..)leads/[leadId]/page.tsx` | 1 | page-title 1 | 1.4 |
| 105 | `src/app/(app)/leads/page.tsx` | 1 | page-title 1 | 1.4 |
| 106 | `src/app/(app)/pipeline/[id]/archived/page.tsx` | 1 | page-title 1 | 1.2 |
| 107 | `src/app/(app)/pipeline/[id]/edit/page.tsx` | 1 | page-title 1 | 1.2 |
| 108 | `src/app/(app)/pipeline/[id]/list/page.tsx` | 1 | page-title 1 | 1.2 |
| 109 | `src/app/(app)/pipeline/[id]/page.tsx` | 1 | page-title 1 | 1.2 |
| 110 | `src/app/(app)/pipeline/page.tsx` | 1 | page-title 1 | 1.2 |
| 111 | `src/app/(app)/projects/[id]/page.tsx` | 1 | page-title 1 | 2.5 |
| 112 | `src/app/(app)/projects/page.tsx` | 1 | page-title 1 | 2.5 |
| 113 | `src/app/(app)/settings/ai/page.tsx` | 1 | page-title 1 | 3.1 |
| 114 | `src/app/(app)/settings/api/page.tsx` | 1 | page-title 1 | 3.1 |
| 115 | `src/app/(app)/settings/audit-log/page.tsx` | 1 | page-title 1 | 3.1 |
| 116 | `src/app/(app)/settings/automations/[id]/page.tsx` | 1 | page-title 1 | 3.1 |
| 117 | `src/app/(app)/settings/automations/page.tsx` | 1 | page-title 1 | 3.1 |
| 118 | `src/app/(app)/settings/backups/page.tsx` | 1 | page-title 1 | 3.1 |
| 119 | `src/app/(app)/settings/booking/[id]/page.tsx` | 1 | page-title 1 | 3.1 |
| 120 | `src/app/(app)/settings/booking/page.tsx` | 1 | page-title 1 | 3.1 |
| 121 | `src/app/(app)/settings/connections/ConnectionsClient.tsx` | 1 | palette 1 | 3.1 |
| 122 | `src/app/(app)/settings/documents/page.tsx` | 1 | page-title 1 | 3.1 |
| 123 | `src/app/(app)/settings/email/page.tsx` | 1 | page-title 1 | 3.1 |
| 124 | `src/app/(app)/settings/email/SignaturesSettingsClient.tsx` | 1 | shadow 1 | 3.1 |
| 125 | `src/app/(app)/settings/email/TemplatesSettingsClient.tsx` | 1 | shadow 1 | 3.1 |
| 126 | `src/app/(app)/settings/fields/FieldList.tsx` | 1 | shadow 1 | 3.1 |
| 127 | `src/app/(app)/settings/fields/FieldRowItem.tsx` | 1 | font-size 1 | 3.1 |
| 128 | `src/app/(app)/settings/forms/[id]/page.tsx` | 1 | page-title 1 | 3.1 |
| 129 | `src/app/(app)/settings/forms/page.tsx` | 1 | page-title 1 | 3.1 |
| 130 | `src/app/(app)/settings/goals/GoalsTable.tsx` | 1 | uppercase 1 | 3.1 |
| 131 | `src/app/(app)/settings/import/ImportWizard.tsx` | 1 | palette 1 | 3.1 |
| 132 | `src/app/(app)/settings/import/UploadStep.tsx` | 1 | palette 1 | 3.1 |
| 133 | `src/app/(app)/settings/notifications/page.tsx` | 1 | page-title 1 | 3.1 |
| 134 | `src/app/(app)/settings/page.tsx` | 1 | page-title 1 | 3.1 |
| 135 | `src/app/(app)/settings/profile/PasswordCard.tsx` | 1 | shadow 1 | 3.1 |
| 136 | `src/app/(app)/settings/recycle-bin/page.tsx` | 1 | page-title 1 | 3.1 |
| 137 | `src/app/(app)/settings/SettingsSurface.tsx` | 1 | shadow 1 | 3.1 |
| 138 | `src/app/(app)/settings/users/UserRowControls.tsx` | 1 | palette 1 | 3.1 |
| 139 | `src/app/(app)/settings/webhooks/page.tsx` | 1 | page-title 1 | 3.1 |
| 140 | `src/app/(auth)/login/LoginPanel.tsx` | 1 | uppercase 1 | 3.2 |
| 141 | `src/app/oauth/authorize/consent.tsx` | 1 | shadow 1 | 3.2 |
| 142 | `src/components/navigation/SecondaryNavLink.tsx` | 1 | palette 1 | 1.1 |
| 143 | `src/components/shell/skeletons.tsx` | 1 | shadow 1 | 1.1 |
| 144 | `src/components/shell/UserMenu.tsx` | 1 | uppercase 1 | 1.1 |
| 145 | `src/features/activities/ActivitiesTable.tsx` | 1 | palette 1 | 1.4 |
| 146 | `src/features/activities/ActivitiesTableHead.tsx` | 1 | uppercase 1 | 1.4 |
| 147 | `src/features/activities/ActivityList.tsx` | 1 | shadow 1 | 1.4 |
| 148 | `src/features/activities/ActivitySortableHeader.tsx` | 1 | font-size 1 | 1.4 |
| 149 | `src/features/activities/AddActivityModal.tsx` | 1 | palette 1 | 1.4 |
| 150 | `src/features/contacts/BulkMergeDialog.tsx` | 1 | palette 1 | 1.4 |
| 151 | `src/features/contacts/ContactFollowersButton.tsx` | 1 | font-size 1 | 1.4 |
| 152 | `src/features/contacts/MergeDialog.tsx` | 1 | palette 1 | 1.4 |
| 153 | `src/features/contacts/OrgsTable.tsx` | 1 | font-size 1 | 1.4 |
| 154 | `src/features/contacts/PeopleTable.tsx` | 1 | font-size 1 | 1.4 |
| 155 | `src/features/custom-fields/CustomFieldCreateFields.tsx` | 1 | uppercase 1 | 3.1 |
| 156 | `src/features/deal-workspace/composer/ActivityComposerInline.tsx` | 1 | palette 1 | 1.3 |
| 157 | `src/features/deal-workspace/header/FollowersButton.tsx` | 1 | font-size 1 | 1.3 |
| 158 | `src/features/deal-workspace/history/ActivityCard.tsx` | 1 | uppercase 1 | 1.3 |
| 159 | `src/features/deals/AddDealPersonColumn.tsx` | 1 | uppercase 1 | 1.2 |
| 160 | `src/features/deals/BoardFilterMenuParts.tsx` | 1 | font-size 1 | 1.2 |
| 161 | `src/features/documents/ui/DocumentEditor.tsx` | 1 | uppercase 1 | 2.3 |
| 162 | `src/features/documents/ui/TemplateDialog.tsx` | 1 | uppercase 1 | 2.3 |
| 163 | `src/features/email/composer/AddActivityToggle.tsx` | 1 | font-size 1 | 2.1 |
| 164 | `src/features/email/composer/ComposeLinkSidebar.tsx` | 1 | uppercase 1 | 2.1 |
| 165 | `src/features/email/composer/RecipientField.tsx` | 1 | shadow 1 | 2.1 |
| 166 | `src/features/email/EmailDraftCard.tsx` | 1 | font-size 1 | 2.1 |
| 167 | `src/features/email/InboxFolderRail.tsx` | 1 | font-size 1 | 2.1 |
| 168 | `src/features/email/ReaderActions.tsx` | 1 | font-size 1 | 2.1 |
| 169 | `src/features/email/ReaderMessageCard.tsx` | 1 | font-size 1 | 2.1 |
| 170 | `src/features/forecast/ui/ForecastCard.tsx` | 1 | shadow 1 | 2.2 |
| 171 | `src/features/identity/OwnerBadge.tsx` | 1 | font-size 1 | 1.4 |
| 172 | `src/features/insights/ui/ReportFilterPanel.tsx` | 1 | uppercase 1 | 2.4 |
| 173 | `src/features/insights/ui/ReportTable.tsx` | 1 | uppercase 1 | 2.4 |
| 174 | `src/features/pipelines/CreatePipelineDialog.tsx` | 1 | palette 1 | 1.2 |
| 175 | `src/features/pipelines/EditPipelineClient.tsx` | 1 | palette 1 | 1.2 |
| 176 | `src/features/pipelines/StageEditCard.tsx` | 1 | palette 1 | 1.2 |
| 177 | `src/features/pwa/offline/ui/OfflineRecord.tsx` | 1 | uppercase 1 | 3.2 |
| 178 | `src/features/quick-add/GlobalContactModal.tsx` | 1 | uppercase 1 | 3.4 |
| 179 | `src/features/saved-filters/SaveViewDialog.tsx` | 1 | palette 1 | 1.2 |
| 180 | `src/features/shortcuts/ShortcutHelp.tsx` | 1 | uppercase 1 | 1.1 |
| 181 | `src/features/stats/ui/GoalsWidget.tsx` | 1 | palette 1 | 2.4 |
| 182 | `src/features/stats/ui/Scoreboard.tsx` | 1 | uppercase 1 | 2.4 |
| 183 | `src/features/theme/AppearanceMenuSection.tsx` | 1 | uppercase 1 | 1.1 |
| 184 | `src/features/webhooks/ui/WebhookDialog.tsx` | 1 | uppercase 1 | 3.1 |

## Section 6.1 differences

Every row is closed by the task in the Task column; the Closed in column is filled in Task 3.4.

| # | Area | Dealflow today | Pipedrive (target) | Task | Closed in |
|---|---|---|---|---|---|
| 1 | Rail | 232 px slate-navy rail with text labels and a "Collapse" item. Its background stops after the last item | 56 px full-height indigo `#211C52` icon-only rail. Brand mark on top. Items 44x44 tiles; active tile violet `#6250E2`. Labels in a dark tooltip `#20232C` | 1.1 | |
| 2 | Top bar | "Dealflow" wordmark left, centred search, square green add button, sparkle and bell icons | 56 px white bar, bottom border `#E8E8E8`. Page title left (16/600) with an info icon. Search pill 240x40 with `#CACACA` border. 40 px round add button. "AI chat" pill `#F6F4FF`. Icon buttons. 40 px initials avatar | 1.1 | |
| 3 | Page title | 25 px title inside the content | Title in the top bar. Content starts with a 64 px toolbar row (view switcher, primary split button, right-side controls) | 0.3, all screens | |
| 4 | Buttons | Green `#047857`, 36 px, radius 8 | Green `#2D8548`, 32 px, radius 4, 14/600. Secondary: white, `#CACACA` border | 0.3 | |
| 5 | Text colours | Slate `#0F172A` and `#64748B` | `#21232C` primary, `#65686F` secondary, `#929196` placeholder | 0.2 | |
| 6 | Links | Indigo `#4338CA` | Record links green `#017737`. Navigational links, active tabs and sort controls blue `#1168C9` | 0.2, screens | |
| 7 | Canvas | Light grey content background | White for board and list pages. `#F5F5F5` for the deal page's activity side and board columns | 0.2, 1.2, 1.3 | |
| 8 | Board columns | Plain columns | `#F5F5F5` columns 248 wide, radius 8, chevron-shaped header (title 16/600, meta 13 `$700 . 2 deals`) | 1.2 | |
| 9 | Deal cards | Rounded cards with shadow | White, 1 px `#E3E3E3` border, radius 4, padding 8/10. Title 14/600, subtitle 13 secondary, avatar 20 plus value 13/600 secondary. Next-activity dot 16 px (green `#58CC85`, grey `#CBCCCE`, red `#D73C38`) | 1.2 | |
| 10 | Deal stage bar | Light tinted chevrons with stage names | 24 px track. Passed and current segments green `#2D8548` with white "17 days"; future segments `#E4E4E4` with secondary "0 days". Chevron joins, radius 4 at the ends. A "Pipeline -> Stage" blue breadcrumb below | 1.3 | |
| 11 | Deal sidebar | Separate rounded cards on a grey background | One flush white column 400 wide with a right border. Section rows 64 high (title 16/600, chevron 20, "..." menu right), with 1 px `#E3E3E3` dividers | 1.3 | |
| 12 | Deal activity side | White | `#F5F5F5` area, padding 24. White composer card, radius 8, `#E8E8E8` border. Tabs 40 high; active tab `#EFF6FF` with blue text and a 2 px blue underline | 1.3 | |
| 13 | Deal header | Owner, follower, Won/Lost on one line | Title 24/400. Owner block (avatar 32, name 14/600, "Owner" 13 secondary, caret). "1 follower" secondary button. Won `#2D8548` and Lost `#D73C38` 32 px buttons. View menu and "..." icon buttons | 1.3 | |
| 14 | Lists | Shadcn table look | Gridded table: header 33 high, 14/600, `#CACACA` bottom border, `#E5E5E5` column lines. Rows 33 high, 14/400, `#E5E5E5` separators. Record links green. Round done marker 18 px `#C3C3C3`. Type chips `#EFF6FF` with blue text | 1.4 | |
| 15 | Badges | Pill badges | Uppercase status badges (OVERDUE red fill, white 12/700; plan tag blue outline `#AFC1EF` on `#EDF2FF` with `#2A53C5` text; NEW blue `#2677EA` pill) | 0.3 | |
| 16 | Notes | White | Note cards yellow `#FFF6D5` | 1.3 | |
| 17 | Mobile nav | Slate | Bottom nav and More sheet in rail colours | 1.1 | |
