import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import config from '../config';

///////////////////////////////
// ParticleEmitter Component //
///////////////////////////////
/**
 * @param {Array<any>} [imageNames] - Array of image filenames (without path). Textures are loaded from `${config.resource_path}/textures/${name}`.
 * @param {number} [count] - Total number of particles.
 * @param {number} [speed] - Movement speed (m/s).
 * @param {number} [initialSize] - Initial particle size (m).
 * @param {number} [maxSizeOverLifespan] - Maximum particle size (m); if 0, size stays constant.
 * @param {number} [lifespan] - Particle lifespan (s).
 * @param {number} [spread] - Random offset (m) for each particle's start position.
 * @param {boolean} [fadeInOut] - If true, particles fade in and out.
 * @param {boolean} [faceCamera] - If true, particles will orient to face the camera. // revise feature later.
 * @param {number} [faceCameraFrameCheck] - Perform face-camera orientation check and update every n frames.
 * @param {Array<any>} [faceCameraAxisLock] - Array [x, y, z] to lock specific axes (1 = follow camera, 0 = lock).
 * @param {number} [instanceMaxRandomDelay] - Extra random delay (s) added per particle.
 * @param {Array<any>} [position] - Position of the emitter.
 * @param {Array<any>} [rotation] - Rotation of the emitter if faceCamera is false.
 * @param {Array<any>} [direction] - Direction of the particle emitter.
 */
export const ParticleEmitter = React.memo((props) => {
  const { imageNames = ["fire1", "fire2"] } = props;
  const { count = 100 } = props;
  const { speed = 1 } = props;
  const { initialSize = 0.5 } = props;
  const { maxSizeOverLifespan = 0 } = props;
  const { lifespan = 2 } = props;
  const { spread = 0.3 } = props;
  const { fadeInOut = false } = props;
  const { faceCamera = false } = props;
  const { faceCameraFrameCheck = 1 } = props;
  const { faceCameraAxisLock = [1, 1, 1] } = props;
  const { instanceMaxRandomDelay = 0 } = props;
  const { position = [0, 0, 0] } = props;
  const { rotation = [0, 0, 0] } = props;
  const { direction = [0, 1, 0] } = props;

  /////////////////////////
  // Build Texture Paths //
  /////////////////////////
  const texturePaths = useMemo(() => 
    imageNames.map(name => `${config.resource_path}/textures/${name}`),
    [imageNames]
  );
  
  ////////////////////////////////////////
  // Load Textures using TextureLoader. //
  ////////////////////////////////////////
  const textures = useLoader(THREE.TextureLoader, texturePaths);

  //////////////////////////////////////////////////////////////////////
  // Create Particle State:                                           //
  //   Each particle receives:                                        //
  //     - A random texture index from the loaded textures.           //
  //     - A delay (sequential base delay plus a random extra delay). //
  //     - A random start position offset based on 'spread'.          //
  //     - An initial age (negative, so that emission is delayed).    //
  //////////////////////////////////////////////////////////////////////
  const particles = useMemo(() => {
    return new Array(count).fill().map((_, i) => {
      const baseDelay = i * (lifespan / count);
      const randomDelay = Math.random() * instanceMaxRandomDelay;
      const delay = baseDelay + randomDelay;
      const startPosition = new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread
      );
      return {
        imageIndex: Math.floor(Math.random() * textures.length),
        delay,
        startPosition,
        position: startPosition.clone(),
        velocity: new THREE.Vector3(...direction).normalize().multiplyScalar(speed),
        age: -delay,
        opacity: 0,
        quaternion: new THREE.Quaternion(),
      };
    });
  }, [count, lifespan, spread, instanceMaxRandomDelay, textures.length, direction, speed]);

  ////////////////////////////////////////////////////////////
  // Group Particles by their Assigned Texture (imageIndex) //
  ////////////////////////////////////////////////////////////
  const groups = useMemo(() => {
    const g = {};
    particles.forEach(p => {
      if (!g[p.imageIndex]) g[p.imageIndex] = [];
      g[p.imageIndex].push(p);
    });
    return g;
  }, [particles]);

  ////////////////////////////////////////////////////
  // Render a ParticleGroup for each texture group. //
  ////////////////////////////////////////////////////
  return (
    <group>
      {Object.keys(groups).map(key => (
        <ParticleGroup
          key={key}
          texture={textures[parseInt(key)]}
          particles={groups[key]}
          speed={speed}
          initialSize={initialSize}
          maxSizeOverLifespan={maxSizeOverLifespan}
          lifespan={lifespan}
          fadeInOut={fadeInOut}
          faceCamera={faceCamera}
          faceCameraFrameCheck={faceCameraFrameCheck}
          faceCameraAxisLock={faceCameraAxisLock}
          rotation={rotation}
          direction={direction}
          position={position}
        />
      ))}
    </group>
  );
}, (prevProps, nextProps) => {
  return JSON.stringify(prevProps) === JSON.stringify(nextProps);
});

export default ParticleEmitter;






// Linear interpolation helper.
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/////////////////////////////
// ParticleGroup Component //
/////////////////////////////
/**
 * @param {*} texture - Texture to use for the particles.
 * @param {*} particles - Array of particle state objects.
 * @param {*} speed - Movement speed in m/s.
 * @param {*} initialSize - Initial size (in meters) of each particle.
 * @param {*} maxSizeOverLifespan - Maximum size reached over the particle's lifespan (if 0, size remains constant).
 * @param {*} lifespan - Particle lifespan in seconds.
 * @param {*} fadeInOut - If true, particles fade in at spawn and fade out at end-of-life.
 * @param {*} faceCamera - If true, particles will always orient to face the camera.
 * @param {*} faceCameraFrameCheck - Update the face-camera orientation every n frames.
 * @param {*} faceCameraAxisLock - Array [x, y, z]: 1 allows the axis to follow the camera, 0 locks it to the default rotation.
 * @param {Array<any>} [rotation] - Emitter's default rotation (used if faceCamera is false or for locked axes).
 * @param {*} direction - Movement direction vector (e.g. [0, 1, 0] for upward).
 * @param {Array<any>} [position] - Position of the emitter.
 */
const ParticleGroup = (props) => {
  const { texture } = props;
  const { particles } = props;
  const { speed } = props;
  const { initialSize } = props;
  const { maxSizeOverLifespan } = props;
  const { lifespan } = props;
  const { fadeInOut } = props;
  const { faceCamera } = props;
  const { faceCameraFrameCheck } = props;
  const { faceCameraAxisLock } = props;
  const { rotation = [0, 0, 0]} = props;
  const { direction } = props;
  const { position = [0, 0, 0] } = props;

  const { camera } = useThree();
  const meshRef = useRef();
  const frameCountRef = useRef(0);

  /////////////////////////////////////////////////////////////////
  // Create Instanced Buffer Attribute for Per-Instance Opacity. //
  /////////////////////////////////////////////////////////////////
  const opacityArray = useMemo(() => {
    const arr = new Float32Array(particles.length);
    arr.fill(0);
    return arr;
  }, [particles.length]);

  ///////////////////////////////////////////////////
  // Attach the Opacity Attribute to the Geometry. //
  ///////////////////////////////////////////////////
  useLayoutEffect(() => {
    if (meshRef.current) {
      meshRef.current.geometry.setAttribute(
        'instanceOpacity',
        new THREE.InstancedBufferAttribute(opacityArray, 1)
      );
    }
  }, [opacityArray]);

  ////////////////////////////////////////////
  // Compute Normalized Movement Direction. //
  ////////////////////////////////////////////
  const dirVector = useMemo(() => {
    return new THREE.Vector3(...direction).normalize().multiplyScalar(speed);
  }, [direction, speed]);

  //////////////////////////////////////////////////////////////////////////////////////////
  // Update Loop: Update Particle State, Position, Opacity, and (if enabled) Orientation. //
  //////////////////////////////////////////////////////////////////////////////////////////
  useFrame((state, delta) => {
    frameCountRef.current++;
    const dummy = new THREE.Object3D();
    particles.forEach((p, i) => {
      // Update particle age.
      p.age += delta;
      if (p.age < 0) {
        p.opacity = 0;
      } else {
        if (p.age > lifespan) {
          // Reset particle while preserving its delay offset.
          p.age -= lifespan;
          p.position.copy(p.startPosition);
          p.opacity = 0;
        } else {
          // Update position.
          p.position.addScaledVector(p.velocity, delta);
          // Apply fade in/out effect.
          if (fadeInOut) {
            const halfLife = lifespan / 2;
            p.opacity = p.age < halfLife
              ? lerp(0, 1, p.age / halfLife)
              : lerp(1, 0, (p.age - halfLife) / halfLife);
          } else {
            p.opacity = Math.max(0, 1 - p.age / lifespan);
          }
        }
      }
      
      // Compute scale via linear interpolation.
      const scale = maxSizeOverLifespan > 0 
        ? lerp(initialSize, maxSizeOverLifespan, Math.max(0, Math.min(p.age, lifespan)) / lifespan)
        : initialSize;
      
      // Update dummy object's transformation.
      dummy.position.copy(p.position);
      dummy.scale.set(scale, scale, scale);
      
      /////////////////////////////////////////////////////////////
      // Feature: Emitter Face the Camera (Might need some work) //
      /////////////////////////////////////////////////////////////
      if (faceCamera) {
        if (frameCountRef.current % faceCameraFrameCheck === 0) {
          const temp = new THREE.Object3D();
          temp.position.copy(p.position);
          temp.lookAt(camera.position);
          if (faceCameraAxisLock) {
            const lookAtEuler = new THREE.Euler().setFromQuaternion(temp.quaternion);
            const emitterEuler = new THREE.Euler(rotation[0], rotation[1], rotation[2]);
            const finalEuler = new THREE.Euler(
              faceCameraAxisLock[0] ? lookAtEuler.x : emitterEuler.x,
              faceCameraAxisLock[1] ? lookAtEuler.y : emitterEuler.y,
              faceCameraAxisLock[2] ? lookAtEuler.z : emitterEuler.z
            );
            p.quaternion.setFromEuler(finalEuler);
          } else {
            p.quaternion.copy(temp.quaternion);
          }
        }
        dummy.quaternion.copy(p.quaternion);
      } else {
        dummy.quaternion.identity();
      }
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      opacityArray[i] = p.opacity;
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.geometry.getAttribute('instanceOpacity').needsUpdate = true;
  });

  ///////////////////////////////////////////////////////
  // Create Custom Material with Per-Instance Opacity. //
  ///////////////////////////////////////////////////////
  const customMaterial = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = `
        attribute float instanceOpacity;
        varying float vInstanceOpacity;
      ` + shader.vertexShader;
      
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vInstanceOpacity = instanceOpacity;`
      );
      
      shader.fragmentShader = `
        varying float vInstanceOpacity;
      ` + shader.fragmentShader;
      
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        'gl_FragColor.a *= vInstanceOpacity;\n#include <dithering_fragment>'
      );
    };
    return mat;
  }, [texture]);

  ///////////////////////////////
  // Return the instancedMesh. //
  ///////////////////////////////
  return (
    <instancedMesh
      ref={meshRef}
      args={[null, customMaterial, particles.length]}
      position={position}
      rotation={faceCamera ? [0, 0, 0] : rotation}
    >
      <planeGeometry args={[1, 1]} />
    </instancedMesh>
  );
};

ParticleEmitter.displayName = "ParticleEmitter";
