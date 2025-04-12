const config = {
    // resource_path: process.env.PUBLIC_URL,
    // models_path: process.env.PUBLIC_URL+"/models/",
    resource_path: "http://localhost:80/wordpress/wp-content/r3f-viewer/",
    models_path: "http://localhost:80/wordpress/wp-content/3DModels/",
    models_variation_path: process.env.PUBLIC_URL+"/models/modelVariations/",
    materials_path: process.env.PUBLIC_URL+"/materials/",
    show_html_menu_graphics_toggle: true,
    check_graphics: true,
    default_graphical_setting: "normal"
};

export default config;
