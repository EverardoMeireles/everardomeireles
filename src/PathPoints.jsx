import * as THREE from "three";

const vectorPoints = {
    "StartingPoint" : new THREE.Vector3(251, 222, -16),
    "MainMenu" : new THREE.Vector3(194, 150, 63),
    "Education" : new THREE.Vector3(-17, 97, 27),
    "Skills" : new THREE.Vector3(13, 35, -15),
    "ProfessionalExpProjects0" : new THREE.Vector3(4, 4, -71),
    "ProfessionalExpProjects1" : new THREE.Vector3(22, 4, -99),
    "ProfessionalExpProjects2" : new THREE.Vector3(-6, 4, -116),
    "ProfessionalExpProjects3" : new THREE.Vector3(-23, 4, -89),
    "ProfessionalExpProjects4" : new THREE.Vector3(5, 24, -71),
    "ProfessionalExpProjects5" : new THREE.Vector3(23, 24, -98),
    "ProfessionalExpProjects6" : new THREE.Vector3(-6, 24, -116),
    "ProfessionalExpProjects7" : new THREE.Vector3(-23, 24, -90),
    "ProfessionalExpProjects8" : new THREE.Vector3(3, 44, -70),
    "ProfessionalExpProjects9" : new THREE.Vector3(22, 44, -99),
    "ProfessionalExpProjects10" : new THREE.Vector3(-6, 44, -116),
    "ProfessionalExpProjects11" : new THREE.Vector3(-23, 44, -89)
}

function estimateMiddlePoint(start, end) {
    var midpoint = start.clone().lerp(end, 0.5);
    var direction = end.clone().sub(start).normalize();
    var perpendicular = new THREE.Vector3(-direction.y, direction.x, direction.z).normalize();
    var offsetDistance = 10; // You can adjust this value based on your requirements
    return midpoint.add(perpendicular.multiplyScalar(offsetDistance));
}

// Point where the initial transition ends
export const firstPoint = new THREE.Vector3(194, 150, 63);

export function getCurve(to, from){
    let returnPath, start, middle, end;
    console.log(path_points[to + "-" + from])
    if(path_points[to + "-" + from] !== undefined)
    {
        returnPath = path_points[to + "-" + from]
    }else
    {
        start = vectorPoints[to];
        end = vectorPoints[from];
        middle = estimateMiddlePoint(start, end);
        returnPath = new THREE.CatmullRomCurve3( [        
            start,
            middle,
            end])
    }
    return returnPath;
}

export const path_points = {
//Paths when user clicks on a navigation item but then returns to the previous item
    "MainMenu-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(194, 150, 63),
        new THREE.Vector3(194, 150, 63),
        new THREE.Vector3(194, 150, 63)]),

    "Education-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-17, 97, 27),
        new THREE.Vector3(-17, 97, 27),
        new THREE.Vector3(-17, 97, 27)]),

    "Skills-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(13, 35, -15),
        new THREE.Vector3(13, 35, -15),
        new THREE.Vector3(13, 35, -15)]),

    "ProfessionalExpProjects0-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(4, 4, -71)]),

    "ProfesysionalExps1-ProfessionalExpProjects1":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(22, 4, -99)]),

    "ProfessionalExpProjects2-ProfessionalExpProjects2":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(-6, 4, -116)]),

    "ProfessionalExpProjects3-ProfessionalExpProjects3":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(-23, 4, -89)]),

    "ProfessionalExpProjects4-ProfessionalExpProjects4":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(5, 24, -71),
        new THREE.Vector3(5, 24, -71),
        new THREE.Vector3(5, 24, -71)]),
    "ProfessionalExpProjects5-ProfessionalExpProjects5":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(23, 24, -98),
        new THREE.Vector3(23, 24, -98),
        new THREE.Vector3(23, 24, -98)]),

    "ProfessionalExpProjects6-ProfessionalExpProjects6":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 24, -116),
        new THREE.Vector3(-6, 24, -116),
        new THREE.Vector3(-6, 24, -116)]),

    "ProfessionalExpProjects7-ProfessionalExpProjects7":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 24, -90),
        new THREE.Vector3(-23, 24, -90),
        new THREE.Vector3(-23, 24, -90)]),

    "ProfessionalExpProjects8-ProfessionalExpProjects8":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(3, 44, -70),
        new THREE.Vector3(3, 44, -70),
        new THREE.Vector3(3, 44, -70)]),

    "ProfessionalExpProjects9-ProfessionalExpProjects9":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 44, -99),
        new THREE.Vector3(22, 44, -99),
        new THREE.Vector3(22, 44, -99)]),

    "ProfessionalExpProjects10-ProfessionalExpProjects10":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 44, -116),
        new THREE.Vector3(-6, 44, -116),
        new THREE.Vector3(-6, 44, -116)]),

    "ProfessionalExpProjects11-ProfessionalExpProjects11":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(-23, 44, -89)]),

// Path when the user clicks on a navigation item seconds after the site has loaded, before the initial transition ends
    "StartingPoint-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(251, 222, -16),
        new THREE.Vector3(58, 96, 11),
        new THREE.Vector3(-17, 97, 27)]),   
        
    "StartingPoint-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(251, 222, -16),
        new THREE.Vector3(75, 69, -30),
        new THREE.Vector3(13, 35, -15)]),

    "StartingPoint-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(251, 222, -16),
        new THREE.Vector3(75, 69, -30),
        new THREE.Vector3(4, 4, -71)]),

    "StartingPoint-ProfessionalExpProjects1":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(251, 222, -16),
        new THREE.Vector3(75, 69, -30),
        new THREE.Vector3(22, 4, -99)]),

    "StartingPoint-ProfessionalExpProjects2":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(251, 222, -16),
        new THREE.Vector3(39, 36, -106),
        new THREE.Vector3(-6, 4, -116)]),

    "StartingPoint-ProfessionalExpProjects3":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(251, 222, -16),
        new THREE.Vector3(-16, 61, -52),
        new THREE.Vector3(-23, 4, -89)]),

    "StartingPoint-ProfessionalExpProjects4":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(251, 222, -16),
        new THREE.Vector3(75, 69, -30),
        new THREE.Vector3(5, 24, -71)]),
        
    "StartingPoint-ProfessionalExpProjects5":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(251, 222, -16),
        new THREE.Vector3(75, 69, -30),
        new THREE.Vector3(22, 24, -99)]),

    "StartingPoint-ProfessionalExpProjects6":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(251, 222, -16),
        new THREE.Vector3(39, 36, -106),
        new THREE.Vector3(-6, 24, -116)]),

    "StartingPoint-ProfessionalExpProjects7":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(251, 222, -16),
        new THREE.Vector3(-16, 61, -52),
        new THREE.Vector3(-23, 24, -89)]),

    "StartingPoint-ProfessionalExpProjects8":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(251, 222, -16),
        new THREE.Vector3(75, 69, -30),
        new THREE.Vector3(4, 44, -71)]),

    "StartingPoint-ProfessionalExpProjects9":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(251, 222, -16),
        new THREE.Vector3(75, 69, -30),
        new THREE.Vector3(22, 44, -99)]),

    "StartingPoint-ProfessionalExpProjects10":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(251, 222, -16),
        new THREE.Vector3(39, 36, -106),
        new THREE.Vector3(-6, 44, -116)]),

    "StartingPoint-ProfessionalExpProjects11":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(251, 222, -16),
        new THREE.Vector3(-16, 61, -52),
        new THREE.Vector3(-23, 44, -89)]),

// Path when the user is on a normal navigation item, but then clicks on a item with a submenu and then click on a submenu item before the transition ends
    "ProfessionalExpProjects0-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(75, 69, -30),
        new THREE.Vector3(194, 150, 63)]),

    "ProfessionalExpProjects1-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(75, 69, -30),
        new THREE.Vector3(194, 150, 63)]),

    "ProfessionalExpProjects2-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(39, 36, -106),
        new THREE.Vector3(194, 150, 63)]),

    "ProfessionalExpProjects3-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(-16, 61, -52),
        new THREE.Vector3(194, 150, 63)]),

    "ProfessionalExpProjects4-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(5, 24, -71),
        new THREE.Vector3(75, 69, -30),
        new THREE.Vector3(194, 150, 63)]),

    "ProfessionalExpProjects5-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 24, -99),
        new THREE.Vector3(75, 69, -30),
        new THREE.Vector3(194, 150, 63)]),

    "ProfessionalExpProjects6-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 24, -116),
        new THREE.Vector3(39, 36, -106),
        new THREE.Vector3(194, 150, 63)]),

    "ProfessionalExpProjects7-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 24, -89),
        new THREE.Vector3(-16, 61, -52),
        new THREE.Vector3(194, 150, 63)]),

    "ProfessionalExpProjects8-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 44, -71),
        new THREE.Vector3(75, 69, -30),
        new THREE.Vector3(194, 150, 63)]),

    "ProfessionalExpProjects9-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 44, -99),
        new THREE.Vector3(75, 69, -30),
        new THREE.Vector3(194, 150, 63)]),

    "ProfessionalExpProjects10-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 44, -116),
        new THREE.Vector3(39, 36, -106),
        new THREE.Vector3(194, 150, 63)]),

    "ProfessionalExpProjects11-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(-16, 61, -52),
        new THREE.Vector3(194, 150, 63)]),

    "ProfessionalExpProjects0-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(-3, -39, -6),
        new THREE.Vector3(-17, 97, 27)]),
    
    "ProfessionalExpProjects1-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(12, -9, -59),
        new THREE.Vector3(-17, 97, 27)]),
        
    "ProfessionalExpProjects2-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(39, 36, -106),
        new THREE.Vector3(-17, 97, 27)]),

    "ProfessionalExpProjects3-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(-17, 96, 3),
        new THREE.Vector3(-17, 97, 27)]),

    "ProfessionalExpProjects4-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 24, -71),
        new THREE.Vector3(-5, -1, -49),
        new THREE.Vector3(-17, 97, 27)]),

    "ProfessionalExpProjects5-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 24, -99),
        new THREE.Vector3(12, -9, -59),
        new THREE.Vector3(-17, 97, 27)]),

    "ProfessionalExpProjects6-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 24, -116),
        new THREE.Vector3(39, 36, -106),
        new THREE.Vector3(-17, 97, 27)]),

    "ProfessionalExpProjects7-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 24, -89),
        new THREE.Vector3(-17, 96, 3),
        new THREE.Vector3(-17, 97, 27)]),

    "ProfessionalExpProjects8-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 44, -71),
        new THREE.Vector3(-5, -1, -49),
        new THREE.Vector3(-17, 97, 27)]),
    
    "ProfessionalExpProjects9-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 44, -99),
        new THREE.Vector3(12, -9, -59),
        new THREE.Vector3(-17, 97, 27)]),

    "ProfessionalExpProjects10-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 44, -116),
        new THREE.Vector3(39, 36, -106),
        new THREE.Vector3(-17, 97, 27)]),

    "ProfessionalExpProjects11-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(-17, 96, 3),
        new THREE.Vector3(-17, 97, 27)]),

    "ProfessionalExpProjects0-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 4, -71),
        new THREE.Vector3(12, 35, -66),
        new THREE.Vector3(13, 35, -15)]),

    "ProfessionalExpProjects1-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 4, -99),
        new THREE.Vector3(12, 35, -66),
        new THREE.Vector3(13, 35, -15)]),

    "ProfessionalExpProjects2-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 4, -116),
        new THREE.Vector3(39, 36, -106),
        new THREE.Vector3(13, 35, -15)]),

    "ProfessionalExpProjects3-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 4, -89),
        new THREE.Vector3(-16, 61, -52),
        new THREE.Vector3(13, 35, -15)]),

    "ProfessionalExpProjects4-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 24, -71),
        new THREE.Vector3(12, 35, -66),
        new THREE.Vector3(13, 35, -15)]),

    "ProfessionalExpProjects5-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 24, -99),
        new THREE.Vector3(12, 35, -66),
        new THREE.Vector3(13, 35, -15)]),

    "ProfessionalExpProjects6-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 24, -116),
        new THREE.Vector3(39, 36, -106),
        new THREE.Vector3(13, 35, -15)]),

    "ProfessionalExpProjects7-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 24, -89),
        new THREE.Vector3(-16, 61, -52),
        new THREE.Vector3(13, 35, -15)]),

    "ProfessionalExpProjects8-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(4, 44, -71),
        new THREE.Vector3(12, 35, -66),
        new THREE.Vector3(13, 35, -15)]),
        
    "ProfessionalExpProjects9-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(22, 44, -99),
        new THREE.Vector3(12, 35, -73),
        new THREE.Vector3(13, 35, -15)]),

    "ProfessionalExpProjects10-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-6, 44, -116),
        new THREE.Vector3(39, 36, -106),
        new THREE.Vector3(13, 35, -15)]),

    "ProfessionalExpProjects11-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-23, 44, -89),
        new THREE.Vector3(-16, 61, -52),
        new THREE.Vector3(13, 35, -15)]),
        
// ordinary transitions
    "MainMenu-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(194, 150, 63),
        new THREE.Vector3(58, 96, 11),
        new THREE.Vector3(-17, 97, 27)]),
    
    "Education-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-17, 97, 27),
        new THREE.Vector3(58, 96, 11),
        new THREE.Vector3(194, 150, 63)]),

    "Education-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-17, 97, 27),
        new THREE.Vector3(8, 97, 8),
        new THREE.Vector3(13, 35, -15)]),

    "Education-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(-17, 97, 27),
        new THREE.Vector3(12, 35, -66),
        new THREE.Vector3(4, 4, -71)]),

    "Skills-Education":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(13, 35, -15),
        new THREE.Vector3(8, 97, 8),
        new THREE.Vector3(-17, 97, 27)]),
        
    "MainMenu-Skills":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(194, 150, 63),
        new THREE.Vector3(75, 69, -30),
        new THREE.Vector3(13, 35, -15)]),

    "Skills-MainMenu":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(13, 35, -15),
        new THREE.Vector3(75, 69, -30),
        new THREE.Vector3(194, 150, 63)]),
        
    "Skills-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(13, 35, -15),
        new THREE.Vector3(12, 35, -66),
        new THREE.Vector3(4, 4, -71)]),

    "MainMenu-ProfessionalExpProjects0":
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(194, 150, 63),
        new THREE.Vector3(75, 69, -30),
        new THREE.Vector3(4, 4, -71)]),

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

    // "StartingPoint-MainMenu":
    // new THREE.CatmullRomCurve3( [        
    //     new THREE.Vector3(251, 222, -16),
    //     new THREE.Vector3(234, 200, 3),
    //     new THREE.Vector3(194, 150, 63)]),

    "StartingPoint": 
    new THREE.CatmullRomCurve3( [        
        new THREE.Vector3(194, 150, 63),
        new THREE.Vector3(15, 10, 15),
        new THREE.Vector3(15, 10, 30)]),
    
    // "StartingPoint-MainMenu": 
    // new THREE.CatmullRomCurve3( [        
    //     new THREE.Vector3(5, 25, -18),
    //     new THREE.Vector3(22, 24, -99)])

}

// Points that the camera will look at throughout the transition.
export const path_points_lookat_dict = {
    // "StartingPoint-MainMenu": {
    //     0.1: new THREE.Vector3(183, 194, 17),
    //     0.7: new THREE.Vector3(34, 21, -52),
    // },

}

// Simplified path for when the path doesn't have custom points path to look at.
// When there is no path defined in path_points_lookat_dict, the camera will default
// to the points below and will look at them during the whole transition.
export const path_points_simple_lookat_dict = {
    "MainMenu": {
        0: new THREE.Vector3(34, 21, -52)},

    "Education": {
        0: new THREE.Vector3(-25, 97, 27)},

    "Skills": {
        0: new THREE.Vector3(0, 35, -15)},

    "ProfessionalExpProjects0": {
        0: new THREE.Vector3(0, 5, -82)},

    "ProfessionalExpProjects1": {
        0: new THREE.Vector3(11, 6, -95)},

    "ProfessionalExpProjects2": {
        0: new THREE.Vector3(-3, 6, -108)},

    "ProfessionalExpProjects3": {
        0: new THREE.Vector3(-14, 6, -93)},

    "ProfessionalExpProjects4": {
        0: new THREE.Vector3(0, 26, -82)},

    "ProfessionalExpProjects5": {
        0: new THREE.Vector3(11, 26, -94)},

    "ProfessionalExpProjects6": {
        0: new THREE.Vector3(-1, 26, -108)},

    "ProfessionalExpProjects7": {
        0: new THREE.Vector3(-14, 26, -92)},

    "ProfessionalExpProjects8": {
        0: new THREE.Vector3(0, 46, -82)},

    "ProfessionalExpProjects9": {
        0: new THREE.Vector3(11, 46, -94)},

    "ProfessionalExpProjects10": {
        0: new THREE.Vector3(-1, 46, -108)},

    "ProfessionalExpProjects11": {
        0: new THREE.Vector3(-14, 46, -92)},
}

export const path_points_experience_menu_location = {
    //index: first page when entering site
    "ProfessionalExpProjects0":{ // First floor 0
        "position":[-8, 0, -81],
        "rotation":-Math.PI/3
    },

    "ProfessionalExpProjects1": { // First floor 1
        "position":[12, 0, -85],
        "rotation":Math.PI/3
    },

    "ProfessionalExpProjects2": { // First floor 2
        "position":[5, 0, -107],
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

// Place Custom transition speeds here
export const path_points_speed = {
    "StartingPoint-MainMenu":{
        0.1:0.14,
        0.5:0.14,
        0.9:0.14
    }
}
