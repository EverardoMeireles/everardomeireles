import * as THREE from "three";

// This does something
export const exampleComponent = React.memo((props) => { 
  const {prop1 = "defaultValue"} = props; // The prop does something
  const {prop2 = "defaultValue"} = props; // The prop does something 
  const {prop3 = "defaultValue"} = props; // The prop does something

    // Code goes here 

  return (
    <>
    </>
  );
});

exampleComponent.displayName = "exampleComponent";
