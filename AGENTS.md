# Frontend Tailwind Template Development Guide

This template provides a React Router frontend with Tailwind CSS and Shadcn UI components for a Node-hosted SSR app.

## Purpose

The frontend-tailwind template sets up:
- **React Router** for routing
- **Tailwind CSS** for styling
- **Shadcn UI** component library
- **better-auth** client integration
- **Vite** for building

## Structure

```
frontend-tailwind/
├── app/
│   ├── root.tsx           # App root component
│   ├── routes/            # Route components
│   │   ├── home.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── components/        # React components
│   ├── lib/
│   │   ├── auth-client.ts # better-auth client
│   │   └── utils.ts
│   └── tailwind.css       # Tailwind imports
├── react-router.config.ts # React Router config
├── vite.config.ts         # Vite configuration
├── tailwind.config.ts     # Tailwind configuration
├── postcss.config.js      # PostCSS configuration
└── tsconfig.json
```

## Key Files

### `app/root.tsx`
Root component that:
- Sets up React Router provider
- Includes global styles
- Defines layout structure

### `app/lib/auth-client.ts`
better-auth client configuration:
- Creates auth client instance
- Exports hooks: `useSession`, `signIn`, `signUp`, `signOut`
- Handles authentication state

### `app/routes/`
Route components:
- Use React Router file-based routing
- Each route is a component
- Can export `loader` and `action` functions

### `tailwind.config.ts`
Tailwind CSS configuration:
- Custom theme settings
- Shadcn UI integration
- Content paths for purging

## Development Guidelines

1. **Adding New Routes**:
   ```typescript
   // app/routes/about.tsx
   export default function About() {
     return <div>About Page</div>;
   }
   ```

2. **Using Shadcn UI Components**:
   ```typescript
   import { Button } from '~/components/ui/button';
   
   <Button variant="default">Click me</Button>
   ```

3. **Styling with Tailwind**:
   ```typescript
   <div className="flex items-center gap-4 p-6 bg-white rounded-lg shadow">
     <h1 className="text-2xl font-bold">Title</h1>
   </div>
   ```

4. **Authentication**:
   ```typescript
   import { useSession, signIn, signOut } from '~/lib/auth-client';
   
   function MyComponent() {
     const { data: session, isPending } = useSession();
     
     if (isPending) return <div>Loading...</div>;
     if (!session) return <button onClick={() => signIn.email({...})}>Sign In</button>;
     
     return (
       <div>
         <p>Hello, {session.user.name}!</p>
         <button onClick={() => signOut()}>Sign Out</button>
       </div>
     );
   }
   ```

5. **API Calls**:
   ```typescript
   const apiHost =
     "";
   const response = await fetch(`${apiHost}/api/endpoint`, {
     headers: {
       'Content-Type': 'application/json',
     },
     credentials: 'include', // Include cookies for auth
   });
   ```

6. **Environment Variables**:
   - Server routes and actions run in the React Router app process.
   - Configure server env vars directly for Node runtime.
   - Use same-origin fetches (or route actions/loaders) for app calls.

## Shadcn UI Components

Install new components:
```bash
npx shadcn-ui@latest add button
```

Components are added to `app/components/ui/`.

## Tailwind Configuration

- Customize theme in `tailwind.config.ts`
- Add custom colors, spacing, etc.
- Shadcn UI uses CSS variables for theming

## When to Modify

- Add new routes/pages
- Create new components
- Configure Tailwind theme
- Add Shadcn UI components
- Update authentication flows
- Add new API integrations
- Configure runtime environment variables

## Best Practices

- **Component Organization**: Keep components in `app/components/`
- **Styling**: Use Tailwind utility classes, avoid custom CSS when possible
- **Type Safety**: Use TypeScript for all components
- **Performance**: Use React Router's code splitting
- **Accessibility**: Use semantic HTML and ARIA attributes
- **Responsive Design**: Use Tailwind's responsive utilities
- **State Management**: Use React hooks, consider Zustand/Redux for complex state

## UI Copy Rules

- Never use meta headings in the product UI. Do not add labels like "Overview", "Summary", "Details", "Reading", "Workspace", or similar framing text.
- Avoid headings in the product UI unless there is a strong usability reason. Default to layouts where content, controls, and spacing make the structure self-explanatory.
- Treat short eyebrow text, helper labels, and section-introducer copy as meta headings too. If the text mainly frames the UI instead of delivering product content, do not add it.
- Do not add labels such as "Visible in your community feed", "Share with the community", "About this post", or similar copy above inputs, upload areas, or controls unless the text is the primary content users need to act on.
- Prefer direct helper copy integrated into the component body or no extra copy at all. Do not create a heading-shaped sentence just to explain the section.
- Before finishing UI copy changes, do a specific pass for meta framing text and remove any label that exists only to describe the block beneath it.

## Route Testing Rule

- Any change that can affect a visible route must include route verification before the task is considered complete.
- Minimum requirement: smoke-test every affected visible route by opening the URL and confirming it renders without client/server errors.
- If a shared layout, auth guard, loader helper, or permission helper is changed, treat all routes using that shared code as affected routes.
- For route-specific UI changes, verify the changed route plus any directly linked entry route that is part of the same user flow.
- Prefer Playwright for smoke coverage. Manual browser verification is acceptable only if Playwright is not practical, and the checked URLs must be stated in the final report.

## E2E Locator Rule

- In `opengather/e2e`, prefer `data-testid` locators for interactive elements, assertions, and repeated UI structures instead of text, role, placeholder, or CSS selectors.
- If a stable locator does not exist yet, add a `data-testid` in the app code as part of the same change rather than falling back to brittle selectors.
- Use text-based assertions only as a secondary content check after locating the relevant container with `getByTestId`.

## Deployment

Deploy the generated Node server from `build/server/index.js` using the same server environment variables described in the project README.

## Common Patterns

### Protected Routes
```typescript
import { useSession } from '~/lib/auth-client';
import { redirect } from 'react-router';

export async function loader() {
  const session = await getSession();
  if (!session) {
    return redirect('/login');
  }
  return null;
}
```

### Form Handling
```typescript
import { Form, useActionData } from 'react-router';

export async function action({ request }) {
  const formData = await request.formData();
  // Process form data
  return { success: true };
}
```

### Loading States
```typescript
import { useNavigation } from 'react-router';

const navigation = useNavigation();
const isLoading = navigation.state === 'loading';
```
