# ♊ Frontend Instructions: React SPA (`/frontend`)

This file contains frontend-specific patterns, conventions, state management strategies, and styling guides for the **React Client**.

---

## 🌀 State Management & Server Cache

The frontend relies heavily on **React Query** (`@tanstack/react-query`) to decouple local component state from database resources.

### 1. Unified Query Keys
Always map Query Keys to matching REST API endpoints to make cache invalidation intuitive and predictable.
*   *Example:* Fetching a specific report uses key `['defect-reports', id]`, which corresponds to `GET /api/defect-reports/:id`.

### 2. Cache Invalidation Patterns
Always invalidate the query cache on mutation success inside pages or components. This ensures immediate synchronization across sidebars, dashboards, and detail views.
*   **Template for Mutation Handlers:**
    ```javascript
    const queryClient = useQueryClient();
    const mutation = useMutation({
      mutationFn: updateReportStatus,
      onSuccess: (data) => {
        toast.success('Workflow advanced successfully!');
        // Invalidate specific report cache
        queryClient.invalidateQueries({ queryKey: ['defect-reports', data.id] });
        // Invalidate general list cache
        queryClient.invalidateQueries({ queryKey: ['defect-reports'] });
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Action failed');
      }
    });
    ```

---

## 🎨 Styling, Aesthetics, and Layout Rules

To ensure a highly professional and aesthetically pleasing enterprise look:

1.  **Vanilla CSS Custom Properties**: Customize visual aspects using CSS variables declared in `src/index.css`. Do not add inline hardcoded hex values or inline styling unless dynamically calculating positions.
2.  **No Tailwind CSS**: Do not use Tailwind CSS classes unless explicitly specified by the user. Use clean, modular Vanilla CSS or styled CSS modules.
3.  **Modern UI Elements**:
    *   **Loading States**: Always implement stylized SVG skeletons or CSS spinners instead of raw "Loading..." text strings.
    *   **Toasts**: Always provide quick visual feedback using `react-hot-toast` for both success and error outcomes.
    *   **Responsiveness**: Build responsive grids (`display: grid` with `grid-template-columns: repeat(auto-fit, minmax(..., 1fr))`) and flex layouts to support both tablet/mobile and desktop devices.

---

## 🧪 Frontend Verification

Before submitting any frontend changes:
1.  **Validate imports and types**: Verify that no relative paths are broken and correct files are referenced.
2.  **Run Linter**: Run the eslint command from the `/frontend` directory to ensure compliance with the repository style guides:
    ```bash
    npm run lint
    ```
