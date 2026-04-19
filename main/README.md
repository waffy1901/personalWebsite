# Personal Website

This project now runs on [Vite](https://vite.dev/) with React and Tailwind CSS.

## Available Scripts

In the project directory, you can run:

### `npm run dev`

Starts the Vite development server. Open the local URL shown in the terminal to view the app.

### `npm start`

Alias for `npm run dev`.

### `npm test`

Runs the test suite with Vitest.

### `npm run build`

Builds the app for production into the `dist` folder.

### `npm run preview`

Serves the production build locally for verification.

## Environment Variables

Vite exposes client-side environment variables only when they use the `VITE_` prefix. This app expects:

- `VITE_GA_MEASUREMENT_ID`
- `VITE_DEPLOY_DATE`
- `VITE_FORMSPREE_KEY`

The `prebuild` script refreshes `VITE_DEPLOY_DATE` automatically before each production build.
