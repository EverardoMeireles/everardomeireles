import * as THREE from "three";

export const path_points = {
    "MainMenu-projects":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(15, 1, 0),
        new THREE.Vector3(10, 7, -9),
        new THREE.Vector3(5, 25, -18)]),

    "projects-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(5, 25, -18),
        new THREE.Vector3(10, 7, -9),
        new THREE.Vector3(15, 1, 0)]),

    "projects": 
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(15, 1, 0),
        new THREE.Vector3(15, 10, 15),
        new THREE.Vector3(15, 10, 30)]),
}

export const path_points_lookat_dict = {
    //index: first page when entering site
    "MainMenu-projects": {
        // 0: new THREE.Vector3(-2, 4, -3),
        0: new THREE.Vector3(0, 26, -19)
    },
    "projects-MainMenu": {
        // 0: new THREE.Vector3(9, 3, 2),
        0: new THREE.Vector3(0, 3, 2)
    },
    // "projects-MainMenu": {
    //     0:new THREE.Vector3(9, 3, 2),
    //     0.5: new THREE.Vector3(0, 3, 2)
    // }
    
    
}