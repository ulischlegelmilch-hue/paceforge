// Ambient-Typen für CSS-Importe (Expo/Metro-Web). Wird sonst beim ersten
// `expo start` als Teil von expo-env.d.ts generiert; hier vorab bereitgestellt,
// damit `tsc --noEmit` ohne laufenden Metro grün ist.
declare module '*.css';
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
