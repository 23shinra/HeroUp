/** Layout for unauthenticated routes (/auth, legal pages). */
export function GuestShell({ children }) {
  return (
    <div id="app">
      <main className="screen">{children}</main>
    </div>
  );
}
