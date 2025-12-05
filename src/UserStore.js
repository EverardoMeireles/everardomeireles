import { create } from 'zustand';

const UserStore = create((set) => ({
  currentSkillHovered: "Python", // keep this to implement portals later
  setSkillHovered: (skill) => set(() => ({ currentSkillHovered: skill })),

  animationTriggerState: false,
  setAnimationTriggerState: (playing) => set(() => ({ animationTriggerState: playing })),

  siteMode: "resume", //Remove on ExperienceFrame, keep on SceneContainer
  setSiteMode: (mode) => set(() => ({ siteMode: mode })),
}));

export default UserStore;
