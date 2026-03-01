# Frontend Tailwind Template Development Guide

This template provides a React Router frontend with Tailwind CSS and Shadcn UI components, deployed on Cloudflare Workers.

## Purpose

The frontend-tailwind template sets up:
- **React Router** for routing
- **Tailwind CSS** for styling
- **Shadcn UI** component library
- **Cloudflare Workers** deployment
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
├── workers/
│   └── app.ts             # Cloudflare Worker entry
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

### `workers/app.ts`
Cloudflare Worker entry point:
- Handles requests
- Serves React Router app
- Configures environment variables

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
- Configure Cloudflare Worker settings

## Best Practices

- **Component Organization**: Keep components in `app/components/`
- **Styling**: Use Tailwind utility classes, avoid custom CSS when possible
- **Type Safety**: Use TypeScript for all components
- **Performance**: Use React Router's code splitting
- **Accessibility**: Use semantic HTML and ARIA attributes
- **Responsive Design**: Use Tailwind's responsive utilities
- **State Management**: Use React hooks, consider Zustand/Redux for complex state

## Deployment

Deploy to Cloudflare Workers:
```bash
npm run wrangler:deploy
```

Update `wrangler.toml` with production settings:
- 
- `compatibility_date`: Worker compatibility date

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
