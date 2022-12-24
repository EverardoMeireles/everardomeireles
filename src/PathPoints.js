import {CustomSinCurve} from "./CustomSinCurve";
import * as THREE from "three";
import {useState} from "react";

export const path_points={
    "index" :
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3( 15, 1, 0 ),
        new THREE.Vector3( 15, 10, -15 ),
        new THREE.Vector3( 15, 10, -30 )]),

    "index-reverse" :
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3( 15, 10, -30 ),
        new THREE.Vector3( 15, 10, -15 ),
        new THREE.Vector3( 15, 1, 0 )]),

    "index-transition" : 
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3( 15, 10, -30 ),
        new THREE.Vector3( 15, 10, -15 ),
        new THREE.Vector3( 15, 10, 0 )]),

    "projects" : 
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3( 15, 1, 0 ),
        new THREE.Vector3( 15, 10, 15 ),
        new THREE.Vector3( 15, 10, 30 )]),
}
export const path_points_lookat={
    "index" :new THREE.Vector3( 0, 0, 0 ),
    "index-reverse" :new THREE.Vector3( 0, 0, 0 ),
    "index-transition" : new THREE.Vector3( -24, 65, -43 ),
    "projects" : new THREE.Vector3( -24, 65, -43 ),
};

