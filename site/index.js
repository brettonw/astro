"use strict;"

let scene;

let currentPosition = [0, 0];

let standardUniforms = Object.create(null);

let showStarsCheckbox;
let showConstellationsCheckbox;
let showCloudsCheckbox;
let showAtmosphereCheckbox;
let fovRange;
let framingRange;
let timeRange;
let dayRange;

let starsNode;
let constellationsNode;
let cloudsNode;
let atmosphereNode;

let timeDisplay;

let scaleRange = function (range, deadZone) {
    let rangeValue = range.value;
    let rangeMax = range.max;
    let rangeMid = rangeMax / 2;
    rangeValue -= rangeMid;
    rangeValue *= (1 + deadZone);
    let rawOffset = Math.max (0, Math.abs (rangeValue) - (deadZone * rangeMid));
    return (Math.sign (rangeValue) * rawOffset) / rangeMid;
};

// interesting points in time
let currentTime;
let geo_2016_11_1_1200 = computeJ2000 (utc (2016, 11, 1, 18, 0, 0));
let eclipse2017 = computeJ2000 (utc (2017, 8, 21, 18, 0, 0));
let dscovrMoonTransit2015 = computeJ2000 (utc (2015, 7, 16, 0, 0, 0));

let draw = function (deltaPosition) {
    let timeType = document.getElementById ("timeTypeSelect").value;
    switch (timeType) {
        case "paused": break;
        case "current": currentTime = computeJ2000 (new Date ()); break;
        case "eclipse-2017": currentTime = eclipse2017; break;
        case "DSCOVR-2015": currentTime = dscovrMoonTransit2015;
        case "2016111-1200": currentTime = geo_2016_11_1_1200;
    }
    let hourDelta = scaleRange(timeRange, 0.025) * 2.0;
    let dayDelta = scaleRange(dayRange, 0.025) * 180.0;
    let displayTime = currentTime + dayDelta + hourDelta;
    Thing.updateAll(displayTime);

    // XXX convert from our display time to a Javascript Date
    timeDisplay.innerHTML = "JD: " + displayTime.toFixed(4);

    // update the current position and clamp or wrap accordingly
    currentPosition = Float2.add (currentPosition, deltaPosition);
    while (currentPosition[0] > 1) {
        currentPosition[0] -= 2;
    }
    while (currentPosition[0] < -1) {
        currentPosition[0] += 2;
    }
    currentPosition[1] = Math.min (currentPosition[1], 0.9);
    currentPosition[1] = Math.max (currentPosition[1], -0.9);

    // set up the projection matrix (earth radius is 1 and we want it to occupy about 75% of the
    // view in the vertical direction - the view is probably wider than that)
    let fovRangeValue = fovRange.value;
    fovRangeValue *= 0.01;
    fovRangeValue *= fovRangeValue;
    fovRangeValue = 1.0 - fovRangeValue;
    starsNode.alpha = fovRangeValue;
    fovRangeValue = 0.5 + (59.5 * fovRangeValue);
    let fov = fovRangeValue;
/*
    let framingRangeValue = framingRange.value;
    framingRangeValue *= 0.01;
    framingRangeValue = 0.1 + (0.9 * framingRangeValue);

    let halfFov = fov / 2.0;
    let goalOpposite = 1.0 / framingRangeValue;
    let sinTheta = Math.sin(Utility.degreesToRadians (halfFov));
    let hypotenuse = goalOpposite / sinTheta;
    */
    //console.log("Setting Projection at: " + hypotenuse);
    // I'm cheating with the near/far, I know the moon and anything orbiting it is the farthest out
    // we'll want to see on the near side, and the starfield on the far side
    /*
    let nearPlane = Math.max (0.1, hypotenuse - 80.0);
    let farPlane = hypotenuse + 211.0;
    */
    let nearPlane = 0.1;
    let farPlane = 620;
    standardUniforms.PROJECTION_MATRIX_PARAMETER = Float4x4.perspective (fov, context.viewportWidth / context.viewportHeight, nearPlane, farPlane);

    let cameraSelect = document.getElementById ("cameraSelect").value;
    let cameraSelectSplit = cameraSelect.split(";");
    let cameraFrom = cameraSelectSplit[0];
    let cameraTo = cameraSelectSplit[1];
    let cameraUp = Utility.defaultValue (cameraSelectSplit[2], "y-up");

    let rootNode = Node.get ("root");

    // get the sun node, run a point through the transformation
    let lookFromNode = Node.get (cameraFrom);
    let lookFromTransform = lookFromNode.getTransform (rootNode);
    let lookFromPoint = Float4x4.preMultiply ([0, 0, 0, 1], lookFromTransform);
    //console.log ("LOOK FROM: " + Float3.str (lookFromPoint));

    // get the earth node, run a point through the transformation
    let lookAtNode = Node.get (cameraTo);
    let lookAtTransform = lookAtNode.getTransform (rootNode);
    let lookAtPoint = Float4x4.preMultiply ([0, 0, 0, 1], lookAtTransform);
    //console.log ("LOOK AT: " + Float3.str (lookAtPoint));

    // figure the up vector
    let up = [0, 1, 0];
    if (cameraUp != "y-up") {
        let upNode = Node.get (cameraUp);
        let upTransform = upNode.getTransform (rootNode);
        let upPoint = Float4x4.preMultiply ([0, 0, 0, 1], upTransform);
        up = Float3.normalize (Float3.subtract (upPoint, lookFromPoint));
    }

    // compute the view matrix
    let viewMatrix = Float4x4.lookFromAt (lookFromPoint, lookAtPoint, up);
    //let viewMatrix = Float4x4.lookAlongAt (3, 50, Float3.subtract (lookAtPoint, lookFromPoint), lookAtPoint);

    // compute the view parameters as up or down, and left or right
    /*
    let upAngle = currentPosition[1] * Math.PI * 0.5;
    let viewOffset = Float2.scale ([Math.cos (upAngle), Math.sin (upAngle)], -hypotenuse);
    */

    // setup the view matrix
    /*
    let viewMatrix = Float4x4.identity ();
    viewMatrix = Float4x4.multiply (Float4x4.rotateX (upAngle), viewMatrix);
    viewMatrix  = Float4x4.multiply (Float4x4.translate ([0, viewOffset[1], viewOffset[0]]), viewMatrix);
    viewMatrix = Float4x4.multiply (Float4x4.rotateY (currentPosition[0] * Math.PI), viewMatrix);
    //viewMatrix = Float4x4.multiply (Float4x4.scale ([ 2, 2, 2 ]), viewMatrix);
    //viewMatrix  = Float4x4.multiply (Float4x4.translate ([ -0.5, -0.5, -0.5 ]), viewMatrix);
    */
    standardUniforms.VIEW_MATRIX_PARAMETER = viewMatrix;
    standardUniforms.MODEL_MATRIX_PARAMETER = Float4x4.identity ();

    // compute the camera position and set it in the standard uniforms
    let vmi = Float4x4.inverse (viewMatrix);
    standardUniforms.CAMERA_POSITION = [vmi[12], vmi[13], vmi[14]];
    //console.log ("CAMERA AT: " + Float3.str (standardUniforms.CAMERA_POSITION));

    // update the visibility layers
    starsNode.enabled = showStarsCheckbox.checked;
    constellationsNode.enabled = showConstellationsCheckbox.checked;
    cloudsNode.enabled = showCloudsCheckbox.checked;
    atmosphereNode.enabled = showAtmosphereCheckbox.checked;

    // draw the scene
    scene.traverse (standardUniforms);
};

let selectCamera = function () {
    let cameraSelect = document.getElementById ("cameraSelect").value;
    let cameraSelectSplit = cameraSelect.split (";");
    let cameraFov = Utility.defaultValue (cameraSelectSplit[3], 0.5);
    fovRange.value = fovRange.max * cameraFov;
    draw ([0, 0]);
};

let buildScene = function () {
    makeRevolve ("cylinder",
        [[1.0, 1.0], [1.0, -1.0], [1.0, -1.0], [0.8, -1.0], [0.8, -1.0], [0.8, 1.0], [0.8, 1.0], [1.0, 1.0]],
        [[1.0, 0.0], [1.0, 0.0], [0.0, -1.0], [0.0, -1.0], [-1.0, 0.0], [-1.0, 0.0], [0.0, 1.0], [0.0, 1.0]],
        36);
    makeBall ("ball", 72);
    makeBall ("ball-small", 36);

    scene = Node.new ({
        name: "root",
        state: function (standardUniforms) {
            // ordinarily, webGl will automatically present and clear when we return control to the
            // event loop from the draw function, but we overrode that to have explicit control.
            // webGl still presents the buffer automatically, but the back buffer is not cleared
            // until we do it...
            context.clearColor (0.0, 0.0, 0.0, 1.0);
            context.clear (context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT);

            // back face culling enabled
            context.enable (context.CULL_FACE);
            context.cullFace (context.BACK);

            // extensions I want for getting gradient infomation inside the fragment shaders
            //context.getExtension ("OES_standard_derivatives");
            //context.getExtension ("EXT_shader_texture_lod");

            // oh for &#^%'s sake, alpha blending should be standard
            context.blendFunc (context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA);
            context.enable (context.BLEND);

            // a little bit of setup for lighting
            standardUniforms.AMBIENT_LIGHT_COLOR = [1.0, 1.0, 1.0];
            standardUniforms.LIGHT_COLOR = [1.0, 1.0, 1.0];
        }
    });

    // add a root camera node
    let cameraNode = Node.new ({
        name: "camera",
        transform: Float4x4.translate([0.0, 0.0, 8.0]),
        children: false
    });
    scene.addChild (cameraNode);

    let starsTransform = Float4x4.identity ();
    // rotate by 180 degrees on the x axis to account for our coordinate system, then Y by 180
    // degrees to orient correctly. then flip it inside out and scale it up
    starsTransform = Float4x4.multiply (Float4x4.rotateX (Math.PI), starsTransform);
    starsTransform = Float4x4.multiply (Float4x4.rotateY (Math.PI), starsTransform);
    starsTransform = Float4x4.multiply (Float4x4.scale (-310), starsTransform);
    starsNode = Node.new ({
        name: "stars",
        transform: starsTransform,
        state: function (standardUniforms) {
            context.disable (context.DEPTH_TEST);
            context.depthMask (false);
            Program.get ("texture").use ();
            standardUniforms.TEXTURE_SAMPLER = "starfield";
            standardUniforms.OUTPUT_ALPHA_PARAMETER = starsNode.alpha;
        },
        shape: "ball"
    });
    scene.addChild (starsNode);

    let starfieldNode = Node.new ({
        name: "starfield",
        state: function (standardUniforms) {
            Program.get ("texture").use ();
            standardUniforms.TEXTURE_SAMPLER = "starfield";
        },
        shape: "ball",
        children: false
    });
    starsNode.addChild (starfieldNode);

    constellationsNode = Node.new ({
        name: "constellations",
        state: function (standardUniforms) {
            Program.get ("overlay").use ();
            standardUniforms.OUTPUT_ALPHA_PARAMETER = starsNode.alpha * 0.25;
            standardUniforms.TEXTURE_SAMPLER = "constellations";
        },
        shape: "ball",
        children: false
    });
    starsNode.addChild (constellationsNode);

    // radii in km so I can do some reasoning about scales...
    let earthRadius = 6378.1370;
    let sunRadius = 695700.0;
    let earthOrbit = 149597870.700;

    let sunDrawDistance = 300;
    let sunDistance = earthOrbit / earthRadius;
    let sunScale = (sunRadius / earthRadius);
    let sunNode = Node.new ({
        name: "sun",
        transform: Float4x4.identity (),
        state: function (standardUniforms) {
            Program.get ("color").use ();
            standardUniforms.OUTPUT_ALPHA_PARAMETER = 1.0;
            standardUniforms.MODEL_COLOR = [255, 241, 234];
        },
        shape: "sphere2",
        children: false
    });
    scene.addChild (sunNode);

    Thing.new ("sun", "sun", function (time) {
        // get the node
        let node = Node.get (this.node);

        // cos and sin routines that work on degrees (unwraps intrinsically)
        let cos = Utility.cos;
        let sin = Utility.sin;

        // compute the julian century
        let jc = time / 36525;

        // compute the mean longitude and mean anomaly of the sun (degrees)
        let meanLongitude = 280.460 + (36000.77 * jc);
        let meanAnomaly = 357.5277233 + (35999.05034 * jc);

        // compute the ecliptic longitude of the sun (degrees)
        let eclipticLongitude = meanLongitude + (1.914666471 * sin (meanAnomaly)) + (0.019994643 * sin (meanAnomaly + meanAnomaly));

        // compute the distance to the sun in astronomical units
        let R = 1.000140612 - (0.016708617 * cos (meanAnomaly)) - (0.000139589 * cos (meanAnomaly + meanAnomaly));

        // compute the ecliptic obliquity (degrees)
        let eclipticObliquity = 23.439291 - (0.0130042 * jc);

        // compute geocentric equatorial coordinates
        let sinEclipticLongitude = sin (eclipticLongitude);
        let I = R * cos (eclipticLongitude);
        let J = R * cos (eclipticObliquity) * sinEclipticLongitude;
        let K = R * sin (eclipticObliquity) * sinEclipticLongitude;

        // I am using a right handed coordinate system where X is positive to the left, Y positive
        // up, and Z positive into the view
        let sunDirection = Float3.normalize ([-I, K, J]);
        //console.log ("SUN: " + Float3.str (sunDirection));
        let sunPosition = Float3.scale (sunDirection, sunDrawDistance);

        // compute the relative scale of the sun to reflect the changing distance in our orbit
        sunScale = (sunRadius / earthRadius) * (sunDrawDistance / (sunDistance * R)); // approx 0.93

        // compute the position of the sun, and update the lighting direction
        node.transform = Float4x4.multiply (Float4x4.scale (sunScale), Float4x4.translate (sunPosition));
        standardUniforms.LIGHT_DIRECTION = sunDirection;
    });

    let moonRadius = 1737.1;
    //let moonOrbit = 384405.0;
    let moonScale = moonRadius / earthRadius; // approx 0.273
    let moonNode = Node.new ({
        name: "moon",
        transform: Float4x4.identity (),
        state: function (standardUniforms) {
            context.enable (context.DEPTH_TEST);
            context.depthMask (true);
            Program.get ("basic-texture").use ();
            standardUniforms.AMBIENT_LIGHT_COLOR = [1.0, 1.0, 1.0];
            standardUniforms.OUTPUT_ALPHA_PARAMETER = 1.0;
            standardUniforms.TEXTURE_SAMPLER = "moon";
            standardUniforms.MODEL_COLOR = [1.0, 1.0, 1.0];
            standardUniforms.AMBIENT_CONTRIBUTION = 0.1;
            standardUniforms.DIFFUSE_CONTRIBUTION = 0.9;
            standardUniforms.SPECULAR_CONTRIBUTION = 0.05;
            standardUniforms.SPECULAR_EXPONENT = 8.0;
        },
        shape: "ball-small",
        children: false
    });
    scene.addChild (moonNode);

    Thing.new ("moon", "moon", function (time) {
        // get the node
        let node = Node.get (this.node);

        // cos and sin routines that work on degrees (unwraps intrinsically)
        let cos = Utility.cos;
        let sin = Utility.sin;

        // compute the julian century
        let jc = time / 36525;

        let eclipticLongitude = 218.32 + (481267.8813 * jc)
        + (6.29 * sin (134.9 + (477198.85 * jc)))
        - (1.27 * sin (259.2 - (413335.38 * jc)))
        + (0.66 * sin (235.7 + (890534.23 * jc)))
        + (0.21 * sin (269.9 + (954397.70 * jc)))
        - (0.19 * sin (357.5 + (35999.05 * jc)))
        - (0.11 * sin (186.6 + (966404.05 * jc)));

        let eclipticLatitude =
            (5.13 * sin (93.3 + (483202.03 * jc)))
          + (0.28 * sin (228.2 + (960400.87 * jc)))
          - (0.28 * sin (318.3 + (6003.18 * jc)))
          - (0.17 * sin (217.6 - (407332.20 * jc)));

        let horizontalParallax = 0.9508
            + (0.0518 * cos (134.9 + (477198.85 * jc)))
            + (0.0095 * cos (259.2 - (413335.38 * jc)))
            + (0.0078 * cos (235.7 + (890534.23 * jc)))
            + (0.0028 * cos (269.9 + (954397.70 * jc)));

        let eclipticObliquity = 23.439291 - (0.0130042 * jc);

        // compute the distance to the sun in astronomical units
        let moonDistance = 1.0 / sin (horizontalParallax);

        // compute geocentric equatorial coordinates
        let cosEclipticLongitude = cos (eclipticLongitude);
        let sinEclipticLongitude = sin (eclipticLongitude);
        let cosEclipticLatitude = cos (eclipticLatitude);
        let sinEclipticLatitude = sin (eclipticLatitude);
        let cosEclipticObliquity = cos (eclipticObliquity);
        let sinEclipticObliquity = sin (eclipticObliquity);
        let I = cosEclipticLatitude * cosEclipticLongitude;
        let J = ((cosEclipticObliquity * cosEclipticLatitude * sinEclipticLongitude) - (sinEclipticObliquity * sinEclipticLatitude));
        let K = ((sinEclipticObliquity * cosEclipticLatitude * sinEclipticLongitude) + (cosEclipticObliquity * sinEclipticLatitude));

        // I am using a right handed coordinate system where X is positive to the left, Y positive
        // up, and Z positive into the view
        let moonDirection = Float3.normalize ([-I, K, J]);
        // moon debugging is easier if the moon is close and big
        //moonDistance = 4.0; moonScale = 1.0;
        let moonPosition = Float3.scale (moonDirection, moonDistance);

        // compute the position of the sun, and update the lighting conversation
        node.transform = Float4x4.chain (Float4x4.scale (moonScale), Float4x4.rotateXAxisTo (moonDirection), Float4x4.translate (moonPosition));
    });

    let worldNode = Node.new ({
        name: "world",
        transform: Float4x4.identity (),
        state: function (standardUniforms) {
            context.enable (context.DEPTH_TEST);
            context.depthMask (true);
        }
    });
    scene.addChild (worldNode);

    let useTest = false;

    let testNode = Node.new ({
        name: "test",
        transform: Float4x4.identity (),
        state: function (standardUniforms) {
            context.enable (context.DEPTH_TEST);
            context.depthMask (true);
            Program.get ("hardlight").use ();
            standardUniforms.OUTPUT_ALPHA_PARAMETER = 1.0;
            standardUniforms.TEXTURE_SAMPLER = "earth-plate-carree";
            standardUniforms.MODEL_COLOR = [1.1, 1.1, 1.1];
            standardUniforms.AMBIENT_CONTRIBUTION = 0.5;
            standardUniforms.DIFFUSE_CONTRIBUTION = 0.5;
        },
        shape: "ball",
        enabled: useTest,
        children: false
    });
    worldNode.addChild (testNode);

    let earthRenderNode = Node.new ({
        enabled:(!useTest)
    });
    worldNode.addChild (earthRenderNode);

    let earthNode = Node.new ({
        name: "earth",
        state: function (standardUniforms) {
            Program.get ("earth").use ()
                .setDayTxSampler ("earth-day")
                .setNightTxSampler ("earth-night")
                .setSpecularMapTxSampler ("earth-specular-map");
            standardUniforms.OUTPUT_ALPHA_PARAMETER = 1.0;
        },
        shape: "ball"
    });
    earthRenderNode.addChild (earthNode);

    // add geostationary satellites (orbit over equator at altitude of ~35,780 km)
    // * MSG _MSG3_ "Meteosat 2nd Generation (aka SEVIRI)" (000.0E) (infrared channels 4)
    // * MET _MET7_ "Meteosat VISSR (aka IODC)" (057.0E) (infrared channel 2)
    // * GOES _GOES13_ "US GOES East" (075.0W) (infrared channel 2)
    // * GOES _GOES15_ "US GOES West" (135.0W) (infrared channel 2)
    // * MTSAT _MTSAT3_ "Himawari 8" (140.7E)
    let addGeoSatellite = function (name, longitude) {
        let geoAltitude = 35780 / earthRadius;
        let geoTransform = Float4x4.chain (
            Float4x4.scale (0.01),
            Float4x4.translate ([geoAltitude, 0, 0]),
            // very slight inclinations
            //Float4x4.rotateZ (Utility.degreesToRadians (0.18)),
            Float4x4.rotateY (Utility.degreesToRadians (180 + longitude))
        );
        let geoNode = Node.new ({
            name: name,
            transform: geoTransform,
            state: function (standardUniforms) {
                context.enable (context.DEPTH_TEST);
                context.depthMask (true);
                Program.get ("basic").use ();
                standardUniforms.MODEL_COLOR = [1.0, 0.5, 0.5];
            },
            shape: "ball-small",
            children: false
        });
        earthRenderNode.addChild (geoNode);
    };
    addGeoSatellite ("MSG3", 0.0);
    addGeoSatellite ("MET7", 57.0);
    addGeoSatellite ("GOES13", -75.0);
    addGeoSatellite ("GOES15", -135.0);
    addGeoSatellite ("MTSAT3", 140.7);

    // add some geo markers
    let addGeoMarker = function (name, radius, latitude, longitude) {
        let geoMarkerTransform = Float4x4.chain (
            Float4x4.scale (0.02),
            Float4x4.translate ([radius, 0, 0]),
            Float4x4.rotateZ (Utility.degreesToRadians (latitude)),
            Float4x4.rotateY (Utility.degreesToRadians (180 + longitude))
        );
        let geoMarkerNode = Node.new ({
            name: name,
            transform: geoMarkerTransform,
            children: false
        });
        earthNode.addChild (geoMarkerNode);
    };
    addGeoMarker ("baltimore", 1.001, 39.2904, -76.6122);
    addGeoMarker ("b-z", 1.001, 39.2904, -76.0);
    addGeoMarker ("b-y", 1.1, 39.2904, -76.6122);

    // clouds at 40km is a bit on the high side..., but it shows well
    let cloudHeight = (40 + earthRadius) / earthRadius;
    cloudsNode = Node.new ({
        name: "clouds",
        transform: Float4x4.scale (cloudHeight),
        state: function (standardUniforms) {
            Program.get ("clouds").use ();
            standardUniforms.OUTPUT_ALPHA_PARAMETER = 0.90;
            standardUniforms.TEXTURE_SAMPLER = "clouds";
        },
        shape: "ball",
        children: false
    });
    earthRenderNode.addChild (cloudsNode);

    // atmosphere at 160km is actually in about the right place
    let atmosphereDepth = (160 + earthRadius) / earthRadius;
    atmosphereNode = Node.new ({
        name: "clouds",
        transform: Float4x4.scale (atmosphereDepth),
        state: function (standardUniforms) {
            Program.get ("atmosphere").use ()
                .setAtmosphereDepth (atmosphereDepth - 1.0);
            standardUniforms.OUTPUT_ALPHA_PARAMETER = 0.5;
        },
        shape: "ball",
        children: false
    });
    earthRenderNode.addChild (atmosphereNode);

    Thing.new ("world", "world", function (time) {
        // get the node
        let node = Node.get (this.node);


        // where D is the number of UT1 days since J2000
        //let D = floor (time);
        let gmst = computeGmstFromJ2000 (time);
        node.transform = Float4x4.rotateY (Utility.degreesToRadians (gmst));
    });

    let dscovrNode = Node.new ({
        name: "DSCOVR",
        transform:Float4x4.identity,
        /*
        state: function (standardUniforms) {
            context.enable (context.DEPTH_TEST);
            context.depthMask (true);
            Program.get ("basic").use ();
            standardUniforms.MODEL_COLOR = [1.0, 0.5, 0.5];
        },
        shape: "ball-small",
        */
        children:false
    });
    scene.addChild (dscovrNode);

    Thing.new ("DSCOVR", "DSCOVR", function (time) {
        // cos and sin routines that work on degrees (unwraps intrinsically)
        let cos = Utility.cos;
        let sin = Utility.sin;

        // compute the julian century
        let jc = time / 36525;

        // compute the mean longitude and mean anomaly of the sun (degrees)
        let meanLongitude = 280.460 + (36000.77 * jc);
        let meanAnomaly = 357.5277233 + (35999.05034 * jc);

        // compute the ecliptic longitude of the sun (degrees)
        let eclipticLongitude = meanLongitude + (1.914666471 * sin (meanAnomaly)) + (0.019994643 * sin (meanAnomaly + meanAnomaly));

        // compute the distance to the sun in astronomical units
        let R = 1.000140612 - (0.016708617 * cos (meanAnomaly)) - (0.000139589 * cos (meanAnomaly + meanAnomaly));

        // compute the ecliptic obliquity (degrees)
        let eclipticObliquity = 23.439291 - (0.0130042 * jc);

        // compute geocentric equatorial coordinates
        let sinEclipticLongitude = sin (eclipticLongitude);
        let I = R * cos (eclipticLongitude);
        let J = R * cos (eclipticObliquity) * sinEclipticLongitude;
        let K = R * sin (eclipticObliquity) * sinEclipticLongitude;

        // I am using a right handed coordinate system where X is positive to the left, Y positive
        // up, and Z positive into the view
        let sunDirection = Float3.normalize ([-I, K, J]);

        // DSCOVR is tracking the L1 point, and seems to be oriented with the geocentric coordinate
        // frame. this is just an approximation of that position, at 0.01 astronomical units. The
        // actual satellite has a Lissajous orbit around the Earth/Sun line, varying approximately
        // +/- 10 degrees over a 6 month period. I'm unable to find a detailed summary of how to
        // compute the position of the satellite, so I'm just going with L1
        let r = 0.01;
        let l1 = Float3.scale (sunDirection, (r * R * earthOrbit) / earthRadius);
        //console.log ("L1 = " + Float3.str (l1));

        // get the node
        let node = Node.get (this.node);
        node.transform = Float4x4.translate (l1);
    });

    //LogLevel.set (LogLevel.TRACE);
    draw ([0, 0]);
};

let onBodyLoad = function () {
    MouseTracker.new ("render-canvas", OnReady.new (null, function (deltaPosition) {
        draw (deltaPosition);
    }), 0.01);
    Render.new ("render-canvas");

    showStarsCheckbox = document.getElementById ("showStarsCheckbox");
    showConstellationsCheckbox = document.getElementById ("showConstellationsCheckbox");
    showCloudsCheckbox = document.getElementById("showCloudsCheckbox");
    showAtmosphereCheckbox = document.getElementById("showAtmosphereCheckbox");
    fovRange = document.getElementById("fovRange");
    framingRange = document.getElementById("framingRange");
    timeRange = document.getElementById ("timeRange");
    dayRange = document.getElementById ("dayRange");
    timeDisplay = document.getElementById("timeDisplay");

    // load the basic shaders from the original soure
    LoaderShader.new ("http://webgl-js.azurewebsites.net/site/shaders/@.glsl")
        .addVertexShaders ("basic")
        .addFragmentShaders([ "basic", "basic-texture", "color", "overlay", "texture" ])
        .go (null, OnReady.new (null, function (x) {
            Program.new ("basic");
            Program.new ("basic-texture", { vertexShader: "basic" });
            Program.new ("color", { vertexShader: "basic" });
            Program.new ("overlay", { vertexShader: "basic" });
            Program.new ("texture", { vertexShader: "basic" });

            // load the astro specific shaders, and build the programs
            LoaderShader.new ("shaders/@.glsl")
                .addFragmentShaders([ "earth", "clouds", "atmosphere", "hardlight" ])
                .go (null, OnReady.new (null, function (x) {
                    Program.new ("earth", { vertexShader: "basic" });
                    Program.new ("clouds", { vertexShader: "basic" });
                    Program.new ("atmosphere", { vertexShader: "basic" });
                    Program.new ("hardlight", { vertexShader: "basic" });

                    // load the textures
                    LoaderPath.new ({ type:Texture, path:"textures/@.png"})
                        .addItems (["clouds", "earth-day", "earth-night", "earth-specular-map", "moon"], { generateMipMap: true })
                        .addItems (["starfield", "constellations"])
                        .go (null, OnReady.new (null, function (x) {
                            LoaderPath.new ({ type:Texture, path:"textures-test/@.png"})
                                .addItems ("earth-plate-carree")
                                .go (null, OnReady.new (null, function (x) {
                                    buildScene ();
                                }));
                        }));

                }));
        }));

};
