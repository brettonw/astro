let Stars = function () {
    let _ = Object.create (null);

    _.make = function () {
        return Shape.new ({
            buffers: function () {
                // create the stars database from the loaded file
                let stars = JSON.parse (TextFile.get ("Stars").text);

                // the min and max V values, so we can interpolate the sizes
                let minV = -1.5, maxV = 8;
                let deltaV = maxV - minV;

                // a basic star triangle list
                let theta = Math.PI / 3.0;
                let cTh = Math.cos (theta);
                let sTh = Math.sin (theta);
                let starPoints = [
                    [ 1.0,  0.0,  0.0,  1.0], // 0
                    [ cTh,  sTh,  0.0,  1.0], // 1
                    [-cTh,  sTh,  0.0,  1.0], // 2
                    [-1.0,  0.0,  0.0,  1.0], // 3
                    [-cTh, -sTh,  0.0,  1.0], // 4
                    [ cTh, -sTh,  0.0,  1.0], // 5
                    [ 0.0,  0.0,  0.0,  1.0]  // 6
                ];
                let starFaceIndices = [
                    6, 1, 0,
                    6, 2, 1,
                    6, 3, 2,
                    6, 4, 3,
                    6, 5, 4,
                    6, 0, 5
                ];

                // the full point buffer
                let positionBuffer = [];
                let colorBuffer = [];
                let indexBuffer = [];

                // walk over the stars
                for (let star of stars) {
                    // get the right ascension and declination of the star, accounting for
                    // our reversed and rotated coordinate frames
                    let ra = (Math.PI / -2.0) + angleToRadians (angleFromString (star.RA));
                    let dec = -angleToRadians (angleFromString (star.Dec));

                    // compute the size of this star, the dimmest will be 0.0001, the
                    // brightest 0.003
                    let interpolant = ((star.V - minV) / deltaV);
                    let size = (0.0075 * (1.0 - interpolant)) + (0.000075 * interpolant);
                    // build a transformation for the star points
                    let transform = Float4x4.chain (
                        Float4x4.scale (size),
                        Float4x4.translate ([0.0, 0.0, 1.0]),
                        Float4x4.rotateX (dec),
                        Float4x4.rotateY (ra)
                    );

                    // transform the star points
                    let pointsBase = positionBuffer.length;
                    for (let point of starPoints) {
                        point = Float3.copy (Float4x4.preMultiply (point, transform));
                        positionBuffer.push (point);
                    }

                    // compute the color for the star, and push the colors into the final
                    // star color buffer
                    let alpha = 0.25 + (0.75 * (1.0 - interpolant));
                    let color = ("K" in star) ? Blackbody.colorAtTemperature(star.K) : [0.5, 0.5, 0.5];
                    for (let i = 1; i < starPoints.length; ++i) {
                        colorBuffer.push ([color[0], color[1], color[2], 0.0]);
                    }
                    //colorBuffer.push ([color[0], color[1], color[2], 0.75 + (0.25 * (1.0 - interpolant))]);
                    colorBuffer.push ([1.0, 1.0, 1.0, alpha]);

                    // push the indices into the final star points buffer
                    for (let index of starFaceIndices) {
                        indexBuffer.push (index + pointsBase);
                    }

                }

                // flatten the buffer as the return result
                return {
                    position: Utility.flatten (positionBuffer),
                    color: Utility.flatten (colorBuffer),
                    index: indexBuffer
                };
            }
        }, "stars");

    };

    return _;
} ();
