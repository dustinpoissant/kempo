export default async ({ owner, name }) => {
  (globalThis.schedulerCalls ||= []).push(`${owner}:${name}`);
  await new Promise(resolve => setTimeout(resolve, 20));
};
