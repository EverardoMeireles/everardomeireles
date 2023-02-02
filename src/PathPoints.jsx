import * as THREE from "three";

export const path_points = {
    "MainMenu-projects":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(15, 1, 0),
        new THREE.Vector3(10, 7, -9),
        new THREE.Vector3(5, 25, -18)]),

    "MainMenu-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(15, 1, 0),
        new THREE.Vector3(-14, 4, -6),
        new THREE.Vector3(-17, -7, -6),
        new THREE.Vector3(-19, -35, -5)]),
    
    "Education-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-19, -35, -5),
        new THREE.Vector3(-17, -7, -6),
        new THREE.Vector3(-14, 4, -6),
        new THREE.Vector3(15, 1, 0)]),

    "Education-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-19, -35, -5),
        new THREE.Vector3(-50, -1, 44),
        new THREE.Vector3(-58, 2, 71)]),

    "Education-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-19, -35, -5),
        new THREE.Vector3(12, -9, -59),
        new THREE.Vector3(4, 4, -71)]),

    "Skills-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-58, 2, 71),
        new THREE.Vector3(-50, -1, 44),
        new THREE.Vector3(-19, -35, -5)]),
        
    "MainMenu-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(15, 1, 0),
        new THREE.Vector3(-4, 5, 34),
        new THREE.Vector3(-30, 5, 40),
        new THREE.Vector3(-58, 2, 71)]),
    
    "Skills-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-58, 2, 71),
        new THREE.Vector3(-30, 5, 40),
        new THREE.Vector3(-4, 5, 34),
        new THREE.Vector3(15, 1, 0)]),
        
    "Skills-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-58, 2, 71),
        new THREE.Vector3(-3, 21, 21),
        new THREE.Vector3(4, 4, -71)]),

    "MainMenu-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(15, 1, 0),
        new THREE.Vector3(15, 10, -19),
        new THREE.Vector3(4, 4, -71)]),

    "ProfessionalExpProjects0-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(15, 10, -19),
        new THREE.Vector3(15, 1, 0)]),

    "ProfessionalExpProjects1-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(10, 30, -45),
        new THREE.Vector3(15, 1, 0)]),

    "ProfessionalExpProjects2-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(-37, 23, -92),
        new THREE.Vector3(15, 1, 0)]),

    "ProfessionalExpProjects3-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(10, 30, -45),
        new THREE.Vector3(15, 1, 0)]),

    "ProfessionalExpProjects4-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(5, 24, -71),
        new THREE.Vector3(10, 30, -45),
        new THREE.Vector3(15, 1, 0)]),

    "ProfessionalExpProjects5-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 24, -99),
        new THREE.Vector3(10, 30, -45),
        new THREE.Vector3(15, 1, 0)]),

    "ProfessionalExpProjects6-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 24, -116),
        new THREE.Vector3(-37, 23, -92),
        new THREE.Vector3(15, 1, 0)]),

    "ProfessionalExpProjects7-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 24, -89),
        new THREE.Vector3(10, 30, -45),
        new THREE.Vector3(15, 1, 0)]),

    "ProfessionalExpProjects8-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 44, -71),
        new THREE.Vector3(10, 30, -45),
        new THREE.Vector3(15, 1, 0)]),

    "ProfessionalExpProjects9-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 44, -99),
        new THREE.Vector3(10, 30, -45),
        new THREE.Vector3(15, 1, 0)]),

    "ProfessionalExpProjects10-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 44, -116),
        new THREE.Vector3(-37, 23, -92),
        new THREE.Vector3(15, 1, 0)]),

    "ProfessionalExpProjects11-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(10, 30, -45),
        new THREE.Vector3(15, 1, 0)]),

    "ProfessionalExpProjects0-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(-3, -39, -6),
        new THREE.Vector3(-19, -35, -5)]),
    
    "ProfessionalExpProjects1-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(12, -9, -59),
        new THREE.Vector3(-19, -35, -5)]),
        
    "ProfessionalExpProjects2-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(-45, -10, -67),
        new THREE.Vector3(-19, -35, -5)]),

    "ProfessionalExpProjects3-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(12, -9, -59),
        new THREE.Vector3(-19, -35, -5)]),

    "ProfessionalExpProjects4-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 24, -71),
        new THREE.Vector3(-5, -1, -49),
        new THREE.Vector3(-19, -35, -5)]),

    "ProfessionalExpProjects5-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 24, -99),
        new THREE.Vector3(12, -9, -59),
        new THREE.Vector3(-19, -35, -5)]),

    "ProfessionalExpProjects6-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 24, -116),
        new THREE.Vector3(-45, -10, -67),
        new THREE.Vector3(-19, -35, -5)]),

    "ProfessionalExpProjects7-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 24, -89),
        new THREE.Vector3(12, -9, -59),
        new THREE.Vector3(-19, -35, -5)]),

    "ProfessionalExpProjects8-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 44, -71),
        new THREE.Vector3(-5, -1, -49),
        new THREE.Vector3(-19, -35, -5)]),
    
    "ProfessionalExpProjects9-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 44, -99),
        new THREE.Vector3(12, -9, -59),
        new THREE.Vector3(-19, -35, -5)]),

    "ProfessionalExpProjects10-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 44, -116),
        new THREE.Vector3(-45, -10, -67),
        new THREE.Vector3(-19, -35, -5)]),

    "ProfessionalExpProjects11-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(12, -9, -59),
        new THREE.Vector3(-19, -35, -5)]),

    "ProfessionalExpProjects0-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(-3, 21, 21),
        new THREE.Vector3(-58, 2, 71)]),

    "ProfessionalExpProjects1-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(-3, 21, 21),
        new THREE.Vector3(-58, 2, 71)]),

    "ProfessionalExpProjects2-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(-72, 5, -33),
        new THREE.Vector3(-58, 2, 71)]),

    "ProfessionalExpProjects3-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(-3, 21, 21),
        new THREE.Vector3(-58, 2, 71)]),

    "ProfessionalExpProjects4-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 24, -71),
        new THREE.Vector3(-3, 21, 21),
        new THREE.Vector3(-58, 2, 71)]),

    "ProfessionalExpProjects5-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 24, -99),
        new THREE.Vector3(-3, 21, 21),
        new THREE.Vector3(-58, 2, 71)]),

    "ProfessionalExpProjects6-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 24, -116),
        new THREE.Vector3(-72, 5, -33),
        new THREE.Vector3(-58, 2, 71)]),

    "ProfessionalExpProjects7-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 24, -89),
        new THREE.Vector3(-3, 21, 21),
        new THREE.Vector3(-58, 2, 71)]),

    "ProfessionalExpProjects8-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 44, -71),
        new THREE.Vector3(-3, 21, 21),
        new THREE.Vector3(-58, 2, 71)]),
        
    "ProfessionalExpProjects9-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 44, -99),
        new THREE.Vector3(-3, 21, 21),
        new THREE.Vector3(-58, 2, 71)]),

    "ProfessionalExpProjects10-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 44, -116),
        new THREE.Vector3(-72, 5, -33),
        new THREE.Vector3(-58, 2, 71)]),

    "ProfessionalExpProjects11-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(-3, 21, 21),
        new THREE.Vector3(-58, 2, 71)]),


    "ProfessionalExpProjects0-ProfessionalExpProjects1":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(12, 7, -77),
        new THREE.Vector3(22, 4, -99)]),

    "ProfessionalExpProjects0-ProfessionalExpProjects2":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(-4, -20, -89),
        new THREE.Vector3(-6, 4, -116)]),

    "ProfessionalExpProjects0-ProfessionalExpProjects3":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(-11, 7, -72),
        new THREE.Vector3(-23, 4, -89)]),

    "ProfessionalExpProjects0-ProfessionalExpProjects4":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(4, 24, -71)]),

    "ProfessionalExpProjects0-ProfessionalExpProjects5":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(12, 14, -77),
        new THREE.Vector3(22, 24, -99)]),

    "ProfessionalExpProjects0-ProfessionalExpProjects6":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(-6, 24, -116)]),

    "ProfessionalExpProjects0-ProfessionalExpProjects7":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(-11, 14, -72),
        new THREE.Vector3(-23, 24, -89)]),

    "ProfessionalExpProjects0-ProfessionalExpProjects8":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(4, 44, -71)]),

    "ProfessionalExpProjects0-ProfessionalExpProjects9":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(12, 14, -77),
        new THREE.Vector3(22, 44, -99)]),

    "ProfessionalExpProjects0-ProfessionalExpProjects10":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(-6, 44, -116)]),

    "ProfessionalExpProjects0-ProfessionalExpProjects11":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(-11, 14, -72),
        new THREE.Vector3(-23, 44, -89)]),

    "ProfessionalExpProjects1-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(12, 7, -77),
        new THREE.Vector3(4, 4, -71)]),
        
    "ProfessionalExpProjects1-ProfessionalExpProjects2":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(13, 7, -114),
        new THREE.Vector3(-6, 4, -116)]),

    "ProfessionalExpProjects1-ProfessionalExpProjects3":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(-4, -20, -89),
        new THREE.Vector3(-23, 4, -89)]),

    "ProfessionalExpProjects1-ProfessionalExpProjects4":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(12, 14, -77),
        new THREE.Vector3(4, 24, -71)]),
        
    "ProfessionalExpProjects1-ProfessionalExpProjects5":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(22, 24, -99)]),

    "ProfessionalExpProjects1-ProfessionalExpProjects6":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(13, 14, -114),
        new THREE.Vector3(-6, 24, -116)]),

    "ProfessionalExpProjects1-ProfessionalExpProjects7":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(-23, 24, -89)]),

    "ProfessionalExpProjects1-ProfessionalExpProjects8":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(12, 14, -77),
        new THREE.Vector3(5, 44, -71)]),

    "ProfessionalExpProjects1-ProfessionalExpProjects9":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(22, 44, -99)]),

    "ProfessionalExpProjects1-ProfessionalExpProjects10":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(13, 14, -114),
        new THREE.Vector3(-6, 44, -116)]),

    "ProfessionalExpProjects1-ProfessionalExpProjects11":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(-23, 44, -89)]),

    "ProfessionalExpProjects2-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(-4, -20, -89),
        new THREE.Vector3(4, 4, -71)]),

    "ProfessionalExpProjects2-ProfessionalExpProjects1":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(13, 7, -114),
        new THREE.Vector3(22, 4, -99)]),

    "ProfessionalExpProjects2-ProfessionalExpProjects3":
    new THREE.CatmullRomCurve3( [
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(-13, 7, -107),
        new THREE.Vector3(-23, 4, -89)]),

    "ProfessionalExpProjects2-ProfessionalExpProjects4":
    new THREE.CatmullRomCurve3( [
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(4, 24, -71)]),

    "ProfessionalExpProjects2-ProfessionalExpProjects5":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(13, 14, -114),
        new THREE.Vector3(22, 24, -99)]),

    "ProfessionalExpProjects2-ProfessionalExpProjects6":
    new THREE.CatmullRomCurve3( [
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(-6, 24, -116)]),

    "ProfessionalExpProjects2-ProfessionalExpProjects7":
    new THREE.CatmullRomCurve3( [
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(-13, 14, -107),
        new THREE.Vector3(-23, 24, -89)]),

    "ProfessionalExpProjects2-ProfessionalExpProjects8":
    new THREE.CatmullRomCurve3( [
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(5, 44, -71)]),

    "ProfessionalExpProjects2-ProfessionalExpProjects9":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(13, 14, -114),
        new THREE.Vector3(22, 44, -99)]),

    "ProfessionalExpProjects2-ProfessionalExpProjects10":
    new THREE.CatmullRomCurve3( [
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(-6, 44, -116)]),

    "ProfessionalExpProjects2-ProfessionalExpProjects11":
    new THREE.CatmullRomCurve3( [
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(-13, 14, -107),
        new THREE.Vector3(-23, 44, -89)]),

    "ProfessionalExpProjects3-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(-11, 7, -72),
        new THREE.Vector3(4, 4, -71)]),

    "ProfessionalExpProjects3-ProfessionalExpProjects1":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(-4, -20, -89),
        new THREE.Vector3(22, 4, -99)]),

    "ProfessionalExpProjects3-ProfessionalExpProjects2":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(-13, 7, -107),
        new THREE.Vector3(-6, 4, -116)]),

    "ProfessionalExpProjects3-ProfessionalExpProjects4":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(-20, 17, -76),
        new THREE.Vector3(5, 24, -71)]),

    "ProfessionalExpProjects3-ProfessionalExpProjects5":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(-4, -20, -89),
        new THREE.Vector3(22, 24, -99)]),

    "ProfessionalExpProjects3-ProfessionalExpProjects6":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(-13, 14, -107),
        new THREE.Vector3(-6, 24, -116)]),

    "ProfessionalExpProjects3-ProfessionalExpProjects7":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(-23, 24, -89)]),

    "ProfessionalExpProjects3-ProfessionalExpProjects8":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(-20, 26, -76),
        new THREE.Vector3(5, 44, -71)]),

    "ProfessionalExpProjects3-ProfessionalExpProjects9":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(-4, -20, -89),
        new THREE.Vector3(22, 44, -99)]),

    "ProfessionalExpProjects3-ProfessionalExpProjects10":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(-13, 14, -107),
        new THREE.Vector3(-6, 44, -116)]),

    "ProfessionalExpProjects3-ProfessionalExpProjects11":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(-23, 44, -89)]),

    "ProfessionalExpProjects4-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(5, 24, -71),
        new THREE.Vector3(4, 4, -71)]),

    "ProfessionalExpProjects4-ProfessionalExpProjects1":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 24, -71),
        new THREE.Vector3(12, 14, -77),
        new THREE.Vector3(22, 4, -99)]),

    "ProfessionalExpProjects4-ProfessionalExpProjects2":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(5, 24, -71),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(-6, 4, -116)]),

    "ProfessionalExpProjects4-ProfessionalExpProjects3":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(5, 24, -71),
        new THREE.Vector3(-11, 16, -72),
        new THREE.Vector3(-23, 4, -89)]),

    "ProfessionalExpProjects4-ProfessionalExpProjects5":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(5, 24, -71),
        new THREE.Vector3(19, 27, -76),
        new THREE.Vector3(22, 24, -99)]),

    "ProfessionalExpProjects4-ProfessionalExpProjects6":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(5, 24, -71),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(-6, 24, -116)]),

    "ProfessionalExpProjects4-ProfessionalExpProjects7":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(5, 24, -71),
        new THREE.Vector3(-11, 27, -72),
        new THREE.Vector3(-23, 24, -89)]),

    "ProfessionalExpProjects4-ProfessionalExpProjects8":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(5, 24, -71),
        new THREE.Vector3(5, 44, -71)]),

    "ProfessionalExpProjects4-ProfessionalExpProjects9":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(5, 24, -71),
        new THREE.Vector3(19, 33, -76),
        new THREE.Vector3(22, 44, -99)]),

    "ProfessionalExpProjects4-ProfessionalExpProjects10":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(5, 24, -71),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(-6, 44, -116)]),

    "ProfessionalExpProjects4-ProfessionalExpProjects11":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(5, 24, -71),
        new THREE.Vector3(-11, 33, -72),
        new THREE.Vector3(-23, 44, -89)]),

    "ProfessionalExpProjects5-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 24, -99),
        new THREE.Vector3(12, 14, -77),
        new THREE.Vector3(4, 4, -71)]),

    "ProfessionalExpProjects5-ProfessionalExpProjects1":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 24, -99),
        new THREE.Vector3(22, 4, -99)]),

    "ProfessionalExpProjects5-ProfessionalExpProjects2":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 24, -99),
        new THREE.Vector3(13, 14, -114),
        new THREE.Vector3(-6, 4, -116)]),

    "ProfessionalExpProjects5-ProfessionalExpProjects3":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 24, -99),
        new THREE.Vector3(-4, -20, -89),
        new THREE.Vector3(-23, 4, -89)]),

    "ProfessionalExpProjects5-ProfessionalExpProjects4":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 24, -99),
        new THREE.Vector3(19, 27, -76),
        new THREE.Vector3(5, 24, -71)]),

    "ProfessionalExpProjects5-ProfessionalExpProjects6":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(23, 24, -98),
        new THREE.Vector3(8, 27, -113),
        new THREE.Vector3(-6, 24, -116)]),

    "ProfessionalExpProjects5-ProfessionalExpProjects7":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(23, 24, -98),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(-23, 24, -89)]),

    "ProfessionalExpProjects5-ProfessionalExpProjects8":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 24, -99),
        new THREE.Vector3(19, 33, -76),
        new THREE.Vector3(3, 44, -70)]),

    "ProfessionalExpProjects5-ProfessionalExpProjects9":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 24, -99),
        new THREE.Vector3(22, 44, -99)]),

    "ProfessionalExpProjects5-ProfessionalExpProjects10":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(23, 24, -98),
        new THREE.Vector3(8, 33, -113),
        new THREE.Vector3(-6, 44, -116)]),

    "ProfessionalExpProjects5-ProfessionalExpProjects11":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 24, -99),
        new THREE.Vector3(19, 33, -76),
        new THREE.Vector3(-23, 44, -89)]),

    "ProfessionalExpProjects6-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 24, -116),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(4, 4, -71)]),
    
    "ProfessionalExpProjects6-ProfessionalExpProjects1":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 24, -116),
        new THREE.Vector3(13, 14, -114),
        new THREE.Vector3(22, 4, -99)]),

    "ProfessionalExpProjects6-ProfessionalExpProjects2":
    new THREE.CatmullRomCurve3( [
        new THREE.Vector3(-6, 24, -116),
        new THREE.Vector3(-6, 4, -116)]),

    "ProfessionalExpProjects6-ProfessionalExpProjects3":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 24, -116),
        new THREE.Vector3(-13, 14, -107),
        new THREE.Vector3(-23, 4, -89)]),
    
    "ProfessionalExpProjects6-ProfessionalExpProjects4":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 24, -116),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(5, 24, -71)]),

    "ProfessionalExpProjects6-ProfessionalExpProjects5":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 24, -116),
        new THREE.Vector3(8, 27, -113),
        new THREE.Vector3(23, 24, -98)]),

    "ProfessionalExpProjects6-ProfessionalExpProjects7":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-5, 24, -116),
        new THREE.Vector3(-15, 27, -108),
        new THREE.Vector3(-23, 24, -89)]),

    "ProfessionalExpProjects6-ProfessionalExpProjects8":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 24, -116),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(3, 44, -70)]),

    "ProfessionalExpProjects6-ProfessionalExpProjects9":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-5, 24, -116),
        new THREE.Vector3(8, 33, -113),
        new THREE.Vector3(22, 44, -99)]),
    
    "ProfessionalExpProjects6-ProfessionalExpProjects10":
    new THREE.CatmullRomCurve3( [
        new THREE.Vector3(-6, 24, -116),
        new THREE.Vector3(-6, 44, -116)]),

    "ProfessionalExpProjects6-ProfessionalExpProjects11":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-5, 24, -116),
        new THREE.Vector3(-15, 33, -108),
        new THREE.Vector3(-23, 44, -89)]),

    "ProfessionalExpProjects7-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 24, -89),
        new THREE.Vector3(-11, 14, -72),
        new THREE.Vector3(4, 4, -71)]),

    "ProfessionalExpProjects7-ProfessionalExpProjects1":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 24, -89),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(22, 4, -99)]),

    "ProfessionalExpProjects7-ProfessionalExpProjects2":
    new THREE.CatmullRomCurve3( [
        new THREE.Vector3(-23, 24, -89),
        new THREE.Vector3(-13, 14, -107),
        new THREE.Vector3(-6, 4, -116)]),

    "ProfessionalExpProjects7-ProfessionalExpProjects3":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 24, -89),
        new THREE.Vector3(-23, 4, -89)]),

    "ProfessionalExpProjects7-ProfessionalExpProjects4":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 24, -89),
        new THREE.Vector3(-11, 27, -72),
        new THREE.Vector3(5, 24, -71)]),

    "ProfessionalExpProjects7-ProfessionalExpProjects5":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 24, -89),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(23, 24, -98)]),

    "ProfessionalExpProjects7-ProfessionalExpProjects6":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 24, -89),
        new THREE.Vector3(-15, 27, -108),
        new THREE.Vector3(-5, 24, -116)]),
    
    "ProfessionalExpProjects7-ProfessionalExpProjects8":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 24, -90),
        new THREE.Vector3(-21, 43, -74),
        new THREE.Vector3(3, 44, -70)]),

    "ProfessionalExpProjects7-ProfessionalExpProjects9":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 24, -89),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(22, 44, -99)]),

    "ProfessionalExpProjects7-ProfessionalExpProjects10":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 24, -89),
        new THREE.Vector3(-15, 33, -108),
        new THREE.Vector3(-6, 44, -116)]),

    "ProfessionalExpProjects7-ProfessionalExpProjects11":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 24, -89),
        new THREE.Vector3(-23, 44, -89)]),

    "ProfessionalExpProjects8-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 44, -71),
        new THREE.Vector3(4, 4, -71)]),

    "ProfessionalExpProjects8-ProfessionalExpProjects1":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(5, 44, -71),
        new THREE.Vector3(12, 14, -77),
        new THREE.Vector3(22, 4, -99)]),

    "ProfessionalExpProjects8-ProfessionalExpProjects2":
    new THREE.CatmullRomCurve3( [
        new THREE.Vector3(5, 44, -71),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(-6, 4, -116)]),

    "ProfessionalExpProjects8-ProfessionalExpProjects3":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(5, 44, -71),
        new THREE.Vector3(-20, 26, -76),
        new THREE.Vector3(-23, 4, -89)]),

    "ProfessionalExpProjects8-ProfessionalExpProjects4":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(3, 44, -70),
        new THREE.Vector3(3, 24, -70)]),

    "ProfessionalExpProjects8-ProfessionalExpProjects5":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(3, 44, -70),
        new THREE.Vector3(19, 33, -76),
        new THREE.Vector3(22, 24, -99)]),

    "ProfessionalExpProjects8-ProfessionalExpProjects6":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(3, 44, -70),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(-6, 24, -116)]),

    "ProfessionalExpProjects8-ProfessionalExpProjects7":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(3, 44, -70),
        new THREE.Vector3(-11, 36, -72),
        new THREE.Vector3(-23, 24, -90)]),

    "ProfessionalExpProjects8-ProfessionalExpProjects9":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(3, 44, -70),
        new THREE.Vector3(16, 47, -81),
        new THREE.Vector3(22, 44, -99)]),

    "ProfessionalExpProjects8-ProfessionalExpProjects10":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(3, 44, -70),
        new THREE.Vector3(3, 70, -92),
        new THREE.Vector3(-6, 44, -116)]),
    
    "ProfessionalExpProjects8-ProfessionalExpProjects11":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(3, 44, -70),
        new THREE.Vector3(-11, 47, -72),
        new THREE.Vector3(-23, 44, -89)]),
    
    "ProfessionalExpProjects9-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 44, -99),
        new THREE.Vector3(12, 14, -77),
        new THREE.Vector3(4, 4, -71)]),
    
    "ProfessionalExpProjects9-ProfessionalExpProjects1":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 44, -99),
        new THREE.Vector3(22, 4, -99)]),

    "ProfessionalExpProjects9-ProfessionalExpProjects2":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 44, -99),
        new THREE.Vector3(13, 14, -114),
        new THREE.Vector3(-6, 4, -116)]),

    "ProfessionalExpProjects9-ProfessionalExpProjects3":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 44, -99),
        new THREE.Vector3(-4, -20, -89),
        new THREE.Vector3(-23, 4, -89)]),

    "ProfessionalExpProjects9-ProfessionalExpProjects4":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 44, -99),
        new THREE.Vector3(19, 33, -76),
        new THREE.Vector3(5, 24, -71)]),

    "ProfessionalExpProjects9-ProfessionalExpProjects5":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 44, -99),
        new THREE.Vector3(22, 24, -99)]),

    "ProfessionalExpProjects9-ProfessionalExpProjects6":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 44, -99),
        new THREE.Vector3(8, 33, -113),
        new THREE.Vector3(-5, 24, -116)]),

    "ProfessionalExpProjects9-ProfessionalExpProjects7":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 44, -99),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(-23, 24, -89)]),

    "ProfessionalExpProjects9-ProfessionalExpProjects8":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 44, -99),
        new THREE.Vector3(16, 47, -81),
        new THREE.Vector3(3, 44, -70)]),

    "ProfessionalExpProjects9-ProfessionalExpProjects10":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(23, 44, -97),
        new THREE.Vector3(15, 47, -107),
        new THREE.Vector3(-6, 44, -116)]),

    "ProfessionalExpProjects9-ProfessionalExpProjects11":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(23, 44, -97),
        new THREE.Vector3(3, 70, -92),
        new THREE.Vector3(-23, 44, -89)]),

    "ProfessionalExpProjects10-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 44, -116),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(4, 4, -71)]),

    "ProfessionalExpProjects10-ProfessionalExpProjects1":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 44, -116),
        new THREE.Vector3(13, 14, -114),
        new THREE.Vector3(22, 4, -99)]),

    "ProfessionalExpProjects10-ProfessionalExpProjects2":
    new THREE.CatmullRomCurve3( [
        new THREE.Vector3(-6, 44, -116),
        new THREE.Vector3(-6, 4, -116)]),

    "ProfessionalExpProjects10-ProfessionalExpProjects3":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 44, -116),
        new THREE.Vector3(-13, 14, -107),
        new THREE.Vector3(-23, 4, -89)]),

    "ProfessionalExpProjects10-ProfessionalExpProjects4":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 44, -116),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(5, 24, -71)]),

    "ProfessionalExpProjects10-ProfessionalExpProjects5":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 44, -116),
        new THREE.Vector3(8, 33, -113),
        new THREE.Vector3(23, 24, -98)]),

    "ProfessionalExpProjects10-ProfessionalExpProjects6":
    new THREE.CatmullRomCurve3( [
        new THREE.Vector3(-6, 44, -116),
        new THREE.Vector3(-6, 24, -116)]),

    "ProfessionalExpProjects10-ProfessionalExpProjects7":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 44, -116),
        new THREE.Vector3(-15, 33, -108),
        new THREE.Vector3(-23, 24, -89)]),

    "ProfessionalExpProjects10-ProfessionalExpProjects8":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 44, -116),
        new THREE.Vector3(3, 70, -92),
        new THREE.Vector3(3, 44, -70)]),

    "ProfessionalExpProjects10-ProfessionalExpProjects9":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 44, -116),
        new THREE.Vector3(15, 47, -107),
        new THREE.Vector3(23, 44, -97)]),

    "ProfessionalExpProjects10-ProfessionalExpProjects11":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-4, 44, -117),
        new THREE.Vector3(-18, 47, -104),
        new THREE.Vector3(-23, 44, -89)]),

    "ProfessionalExpProjects11-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(-11, 14, -72),
        new THREE.Vector3(4, 4, -71)]),

    "ProfessionalExpProjects11-ProfessionalExpProjects1":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(3, 75, -92),
        new THREE.Vector3(22, 4, -99)]),

    "ProfessionalExpProjects11-ProfessionalExpProjects2":
    new THREE.CatmullRomCurve3( [
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(-13, 14, -107),
        new THREE.Vector3(-6, 4, -116)]),

    "ProfessionalExpProjects11-ProfessionalExpProjects3":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(-23, 4, -89)]),

    "ProfessionalExpProjects11-ProfessionalExpProjects4":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(-11, 33, -72),
        new THREE.Vector3(5, 24, -71)]),

    "ProfessionalExpProjects11-ProfessionalExpProjects5":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(19, 33, -76),
        new THREE.Vector3(22, 24, -99)]),

    "ProfessionalExpProjects11-ProfessionalExpProjects6":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(-15, 33, -108),
        new THREE.Vector3(-5, 24, -116)]),

    "ProfessionalExpProjects11-ProfessionalExpProjects7":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(-23, 24, -89)]),

    "ProfessionalExpProjects11-ProfessionalExpProjects8":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(-11, 47, -72),
        new THREE.Vector3(3, 44, -70)]),

    "ProfessionalExpProjects11-ProfessionalExpProjects9":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(3, 70, -92),
        new THREE.Vector3(23, 44, -97)]),

    "ProfessionalExpProjects11-ProfessionalExpProjects10":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(-18, 47, -104),
        new THREE.Vector3(-4, 44, -117)]),

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
    
    // "projects-MainMenu": 
    // new THREE.CatmullRomCurve3( [        
    //     new THREE.Vector3(5, 25, -18),
    //     new THREE.Vector3(22, 24, -99)])

}

//simplified path constant so i don't have to change it for hundreds of individual paths
export const path_points_simple_lookat_dict = {
    //index: first page when entering site
    "MainMenu": {
        0: new THREE.Vector3(0, 3, 2)},

    // "MainMenu": {
    //     0: new THREE.Vector3(11, 25, -94)},

    "Education": {
        0: new THREE.Vector3(-23, -34.5, -4.5)},

    "Skills": {
        0: new THREE.Vector3(-32, 3, 69)},

    "ProfessionalExpProjects0": {
        0: new THREE.Vector3(0, 5, -82)},

    "ProfessionalExpProjects1": {
        0: new THREE.Vector3(11, 5, -94)},

    "ProfessionalExpProjects2": {
        0: new THREE.Vector3(-1, 5, -108)},

    "ProfessionalExpProjects3": {
        0: new THREE.Vector3(-14, 5, -93)},

    "ProfessionalExpProjects4": {
        0: new THREE.Vector3(0, 25, -82)},

    "ProfessionalExpProjects5": {
        0: new THREE.Vector3(11, 25, -94)},

    "ProfessionalExpProjects6": {
        0: new THREE.Vector3(-1, 25, -108)},

    "ProfessionalExpProjects7": {
        0: new THREE.Vector3(-14, 25, -92)},

    "ProfessionalExpProjects8": {
        0: new THREE.Vector3(0, 45, -82)},

    "ProfessionalExpProjects9": {
        0: new THREE.Vector3(11, 45, -94)},

    "ProfessionalExpProjects10": {
        0: new THREE.Vector3(-1, 45, -108)},

    "ProfessionalExpProjects11": {
        0: new THREE.Vector3(-14, 45, -92)},
}

export const path_points_lookat_dict = {
    // index: first page when entering site
    // "MainMenu-projects": {
    //     0: new THREE.Vector3(-2, 4, -3),
    //     0.5: new THREE.Vector3(0, 26, -19)
    // },

    // "MainMenu-ProfessionalExpProjects0": {
    //     0.0: new THREE.Vector3(0, 5, -82)
    // },

    // "ProfessionalExpProjects0-MainMenu": {
    //     0.0: new THREE.Vector3(0, 3, 2)
    // },

    // "ProfessionalExpProjects0-ProfessionalExpProjects1": {
    //     0.0: new THREE.Vector3(11, 5, -94)
    // },

    // "ProfessionalExpProjects0-ProfessionalExpProjects3": {
    //     0.0: new THREE.Vector3(-14, 5, -92)
    // },

    // "ProfessionalExpProjects0-ProfessionalExpProjects4": {
    //     0.0: new THREE.Vector3(0, 25, -82)
    // },

    // "ProfessionalExpProjects1-ProfessionalExpProjects0": {
    //     0.0: new THREE.Vector3(0, 5, -82)
    // },

    // "ProfessionalExpProjects1-ProfessionalExpProjects2": {
    //     0.0: new THREE.Vector3(-1, 5, -108)
    // },

    // "ProfessionalExpProjects1-ProfessionalExpProjects5": {
    //     0.0: new THREE.Vector3(11, 25, -94)
    // },

    // "ProfessionalExpProjects2-ProfessionalExpProjects1": {
    //     0.0: new THREE.Vector3(11, 5, -94)
    // },

    // "ProfessionalExpProjects2-ProfessionalExpProjects3": {
    //     0.0: new THREE.Vector3(-14, 5, -92)
    // },

    // "ProfessionalExpProjects2-ProfessionalExpProjects6": {
    //     0.0: new THREE.Vector3(-1, 25, -108)
    // },

    // "ProfessionalExpProjects3-ProfessionalExpProjects2": {
    //     0.0: new THREE.Vector3(-1, 5, -108)
    // },

    // "ProfessionalExpProjects3-ProfessionalExpProjects4": {
    //     0.0: new THREE.Vector3(2, 25, -83)
    // },

    // "ProfessionalExpProjects3-ProfessionalExpProjects7": {
    //     0.0: new THREE.Vector3(-14, 25, -92)
    // },
    
    // "ProfessionalExpProjects4-ProfessionalExpProjects0": {
    //     0.0: new THREE.Vector3(0, 5, -82)
    // },

    // "ProfessionalExpProjects4-ProfessionalExpProjects8": {
    //     0.0: new THREE.Vector3(0, 45, -82)
    // },

    // "ProfessionalExpProjects4-ProfessionalExpProjects5": {
    //     0.0: new THREE.Vector3(12, 25, -95)
    // },

    // "ProfessionalExpProjects5-ProfessionalExpProjects6": {
    //     0.0: new THREE.Vector3(-2, 25, -106)
    // },

    // "ProfessionalExpProjects5-ProfessionalExpProjects9": {
    //     0.0: new THREE.Vector3(11, 45, -94)
    // },

    // "ProfessionalExpProjects6-ProfessionalExpProjects7": {
    //     0.0: new THREE.Vector3(-12, 25, -93)
    // },

    // "ProfessionalExpProjects6-ProfessionalExpProjects10": {
    //     0.0: new THREE.Vector3(-1, 45, -108)
    // },

    // "ProfessionalExpProjects7-ProfessionalExpProjects3": {
    //     0.0: new THREE.Vector3(-14, 5, -92)
    // },

    // "ProfessionalExpProjects7-ProfessionalExpProjects8": {
    //     0.0: new THREE.Vector3(0, 45, -82)
    // },

    // "ProfessionalExpProjects7-ProfessionalExpProjects11": {
    //     0.0: new THREE.Vector3(-14, 45, -92)
    // },

    // "ProfessionalExpProjects8-ProfessionalExpProjects9": {
    //     0.0: new THREE.Vector3(11, 45, -93)
    // },

    // "ProfessionalExpProjects9-ProfessionalExpProjects10": {
    //     0.0: new THREE.Vector3(-1, 45, -105)
    // },

    // "ProfessionalExpProjects10-ProfessionalExpProjects11": {
    //     0.0: new THREE.Vector3(-12, 45, -96)
    // },

    // "ProfessionalExpProjects11-ProfessionalExpProjects7": {
    //     0.0: new THREE.Vector3(-12, 25, -93)
    // },

    // "projects-MainMenu": {
    //     0: new THREE.Vector3(9, 3, 2),
    //     0.5: new THREE.Vector3(0, 3, 2)
    // },
    
    // "projects-MainMenu": {
    //     0: new THREE.Vector3(-12, 45, -96),
    // }
}

export const path_points_experience_menu_location = {
    //index: first page when entering site
    "ProfessionalExpProjects0":{ // First floor 0
        "position":[-8, 0, -81],
        "rotation":-Math.PI/3
    },

    "ProfessionalExpProjects1": { // First floor 1
        "position":[13, 0, -87],
        "rotation":Math.PI/3
    },

    "ProfessionalExpProjects2": { // First floor 2
        "position":[5, 0, -109],
        "rotation":3*Math.PI/4
    },

    "ProfessionalExpProjects3": { // First floor 3
        "position":[-14, 0, -100],
        "rotation":-3*Math.PI/4
    },

    "ProfessionalExpProjects4": { // Second floor 0
        "position":[-8, 20, -81],
        "rotation":-Math.PI/3
    },

    "ProfessionalExpProjects5": { // Second floor 1
        "position":[13, 20, -87],
        "rotation":Math.PI/3
    },

    "ProfessionalExpProjects6": { // Second floor 2
        "position":[5, 20, -109],
        "rotation":3*Math.PI/4
    },

    "ProfessionalExpProjects7": { // Second floor 3
        "position":[-14, 20, -99],
        "rotation":-3*Math.PI/4
    },

    "ProfessionalExpProjects8": { // Third floor 0
        "position":[-8, 40, -81],
        "rotation":-Math.PI/3
    },

    "ProfessionalExpProjects9": { // Third floor 1
        "position":[13, 40, -87],
        "rotation":Math.PI/3
    },

    "ProfessionalExpProjects10": { // Third floor 2
        "position":[5, 40, -109],
        "rotation":3*Math.PI/4
    },

    "ProfessionalExpProjects11": { // Third floor 3
        "position":[-14, 40, -99],
        "rotation":-3*Math.PI/4
    },
}