# GA4 Event Map

## Event Sources

- `main/src/utils/analytics.js`: GA initialization, event sending, link params.
- `main/src/hooks/usePageTracking.jsx`: manual SPA page views.
- `main/src/pages/Home.jsx`: home resume download.
- `main/src/pages/Resume.jsx`: resume open/download.
- `main/src/components/ProjectCard.jsx`: project source and details interactions.
- `main/src/pages/CaseStudies.jsx` and `main/src/pages/CaseStudy.jsx`: case-study navigation.
- `main/src/components/ContactForm.jsx`: contact submit and success.

## Key-Event Candidates

- `resume_download`
- `contact_form_success`
- `project_source_click`
- `case_study_link_click`

## Diagnostic Events

- `page_view`
- `resume_open`
- `social_link_click`
- `project_details_open`
- `case_study_card_click`
- `contact_form_submit`
- `contact_email_click`
