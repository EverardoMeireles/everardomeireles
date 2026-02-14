import React, { useState, useEffect } from 'react';
import { TextureLoader } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import config from '../config';
import { hasTriggerName, setNamedTrigger } from "../Helper";
import SystemStore from "../SystemStore";

export const PreloadAssets = React.memo((props) => {
  const {texturesToLoad = ["image1.jpg", "image2.jpg"]} = props;
  const {scenesToLoad = ["scene1.glb", "scene2.glb"]} = props;
  const {delay = 3000} = props;
  const {fallbackTimeout = 10000} = props; // ms; if reached, preload completes anyway.
  const {triggerInStart = false} = props;
  const {triggerOutPreloadDone = ""} = props;

  const setTrigger = SystemStore((state) => state.setTrigger);
  const triggerInStartValue = SystemStore((state) =>
    hasTriggerName(triggerInStart) ? Boolean(state.triggers[triggerInStart]) : false
  );

  const [startLoading, setStartLoading] = useState(false);
  const [preloadDone, setPreloadDone] = useState(false);

  const shouldStartLoading = hasTriggerName(triggerInStart)
    ? triggerInStartValue
    : Boolean(triggerInStart);

  // Keep output trigger in sync with local preload completion state.
  useEffect(() => {
    setNamedTrigger(setTrigger, triggerOutPreloadDone, preloadDone);
  }, [setTrigger, triggerOutPreloadDone, preloadDone]);

  useEffect(() => {
    let frameId = undefined;
    const startLoadCycle = () => {
      // Reset cycle state so the completion trigger can fire again.
      setStartLoading(false);
      setPreloadDone(false);
      frameId = requestAnimationFrame(() => {
        setStartLoading(true);
      });
    };

    if (shouldStartLoading) {
      startLoadCycle();
      return () => {
        if (frameId !== undefined) {
          cancelAnimationFrame(frameId);
        }
      };
    }

    // Keep delay-based behavior only when triggerInStart is not a named trigger.
    if (hasTriggerName(triggerInStart)) {
      setStartLoading(false);
      return () => {
        if (frameId !== undefined) {
          cancelAnimationFrame(frameId);
        }
      };
    }

    const timer = setTimeout(startLoadCycle, delay);

    return () => {
      clearTimeout(timer); // Cleanup the timer if the component unmounts
      if (frameId !== undefined) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [delay, shouldStartLoading, triggerInStart]);

  useEffect(() => {
    if (!startLoading || preloadDone) return undefined;

    let cancelled = false;
    let finishedByFallback = false;

    const textureLoader = new TextureLoader();
    const gltfLoader = new GLTFLoader();
    const texturePaths = texturesToLoad.map((texture) => config.resource_path + 'textures/' + texture);
    const scenePaths = scenesToLoad.map((scene) => config.resource_path + 'models/' + scene);

    const assetLoadPromises = [
      ...texturePaths.map((path) => textureLoader.loadAsync(path)),
      ...scenePaths.map((path) => gltfLoader.loadAsync(path))
    ];

    let timeoutId = undefined;
    const hasFallbackTimeout = Number.isFinite(fallbackTimeout) && fallbackTimeout > 0;

    if (hasFallbackTimeout) {
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        finishedByFallback = true;
        console.warn(`Preload fallback reached after ${fallbackTimeout}ms. Continuing without waiting for all assets.`);
        setPreloadDone(true);
      }, fallbackTimeout);
    }

    Promise.all(assetLoadPromises)
      .then(() => {
        if (cancelled || finishedByFallback) return;
        setPreloadDone(true);
      })
      .catch((error) => {
        if (cancelled || finishedByFallback) return;
        console.warn("Preload failed for at least one asset. Continuing with fallback behavior.", error);
        setPreloadDone(true);
      })
      .finally(() => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
      });

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [fallbackTimeout, preloadDone, scenesToLoad, startLoading, texturesToLoad]);

  return null;
});

PreloadAssets.displayName = "PreloadAssets";
