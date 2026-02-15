import * as THREE from "three";

// This does something
/**
 * @param {string} [prop1] - The prop does something.
 * @param {string} [prop2] - The prop does something.
 * @param {string} [prop3] - The prop does something.
 */
export const exampleComponent = React.memo((props) => { 
  const {prop1 = "defaultValue"} = props;
  const {prop2 = "defaultValue"} = props;
  const {prop3 = "defaultValue"} = props;

    // Code goes here 

  return (
    <>
    </>
  );
});

exampleComponent.displayName = "exampleComponent";
