/*
  The admin dashboard widgets an extension's config declares. They are `admin_dashboard_widgets`; the older name,
  `widgets`, is still read so extensions written before the rename keep working. (`page_widgets` are the widgets a
  page can hold, which are a different thing.)
*/
export default config => config?.admin_dashboard_widgets ?? config?.widgets ?? [];
