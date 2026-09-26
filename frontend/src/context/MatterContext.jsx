import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  MatterContext,
} from "./useMatter";

const EMPTY_MATTER = {
  story: "",
  date: "",
  unsureDate: false,
  involvedType: "",
  involvedName: "",
  files: [],
  timeline: [],
};

function createEmptyMatter() {
  return {
    ...EMPTY_MATTER,
    files: [],
    timeline: [],
  };
}

function loadSavedMatter() {
  try {
    const savedMatter =
      localStorage.getItem(
        "verdict-current-matter"
      );

    if (!savedMatter) {
      return createEmptyMatter();
    }

    const parsedMatter =
      JSON.parse(savedMatter);

    return {
      ...createEmptyMatter(),
      ...parsedMatter,

      // Browser File objects cannot be
      // restored from localStorage.
      files: [],

      timeline: Array.isArray(
        parsedMatter.timeline
      )
        ? parsedMatter.timeline
        : [],
    };
  } catch {
    return createEmptyMatter();
  }
}

export function MatterProvider({
  children,
}) {
  const [matter, setMatter] =
    useState(loadSavedMatter);

  const skipNextSave =
    useRef(false);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    try {
      const matterToSave = {
        ...matter,

        // Files will eventually be
        // stored securely in the backend.
        files: [],
      };

      localStorage.setItem(
        "verdict-current-matter",
        JSON.stringify(
          matterToSave
        )
      );
    } catch (error) {
      console.error(
        "Unable to save matter locally:",
        error
      );
    }
  }, [matter]);

  const updateMatter =
    useCallback((updates) => {
      setMatter((current) => ({
        ...current,
        ...updates,
      }));
    }, []);

  const clearMatter =
    useCallback(() => {
      skipNextSave.current = true;

      setMatter(
        createEmptyMatter()
      );

      try {
        localStorage.removeItem(
          "verdict-current-matter"
        );
      } catch (error) {
        console.error(
          "Unable to clear saved matter:",
          error
        );
      }
    }, []);

  const contextValue =
    useMemo(
      () => ({
        matter,
        setMatter,
        updateMatter,
        clearMatter,
      }),
      [
        matter,
        updateMatter,
        clearMatter,
      ]
    );

  return (
    <MatterContext.Provider
      value={contextValue}
    >
      {children}
    </MatterContext.Provider>
  );
}