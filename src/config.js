const config = {
    models_path: process.env.PUBLIC_URL + "/models/",
    resource_path: process.env.PUBLIC_URL,
    materials_path: process.env.PUBLIC_URL + "/materials/",
    show_html_menu_graphics_toggle: true,
    check_graphics: false,
    default_graphical_setting: "normal",
    default_Camera_starting_position: [0, 0, 0],
    viewer_ui_split: [100, 0], // [viewerPercent, uiPercent]
};

export default config;
