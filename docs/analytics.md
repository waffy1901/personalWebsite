# Analytics Setup

The app emits GA4 events from `main/src/utils/analytics.js` when `VITE_GA_MEASUREMENT_ID` is set. The client can send events, but key-event classification happens inside the Google Analytics property.

## Recommended Key Events

Mark these GA4 events as key events after they appear in the property:

| Event | Why it matters | Main params |
| --- | --- | --- |
| `resume_download` | Strong hiring-intent action from home or resume page. | `placement` |
| `contact_form_success` | Completed contact conversion. | `placement` |
| `project_source_click` | Visitor opened source code from a project card. | `project_id`, `project_title`, `link_url`, `placement` |
| `case_study_link_click` | Visitor continued from a case study into supporting evidence. | `case_study_slug`, `link_type`, `link_url`, `placement` |

Keep these as diagnostic events rather than key events at first:

| Event | Use |
| --- | --- |
| `project_details_open` | Compare project-card detail engagement against source-code clicks. |
| `case_study_card_click` | Measure which case studies pull visitors deeper. |
| `resume_open` | Separate PDF preview interest from explicit downloads. |
| `contact_form_submit` | Detect form attempts that do not become successful submissions. |
| `social_link_click` | Understand outbound professional-network interest. |
| `contact_email_click` | Capture fallback contact interest when the form is unavailable. |

## Review Cadence

Review key-event counts monthly alongside landing page, device, and route data. If `project_details_open` is high but `project_source_click` is low, the hidden details may be useful but not persuasive enough. If `project_details_open` is low, move the strongest proof point from the back of each card onto the front.
