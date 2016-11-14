precision highp float;

uniform mat4 normalMatrix;
uniform float outputAlpha;

uniform vec3 lightDirection;
uniform vec3 cameraPosition;

uniform sampler2D dayTxSampler;
uniform sampler2D nightTxSampler;
uniform sampler2D specularMapTxSampler;

uniform vec4 sunPosition;
uniform vec4 moonPosition;

varying vec3 model;
varying vec3 normal;
varying vec2 texture;

vec3 v3 (const in vec4 v4) {
    return vec3 (v4.x, v4.y, v4.z);
}

#define PI 3.14159265358979323846
#define INFLECTION_PT 0.7886751345948128

float linearStep (const float edge0, const float edge1, const float x) {
    return clamp ((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

float hermite (const float x) {
    return x * x * (3.0 - (2.0 * x));
}

float mystep (const float edge0, const float edge1, const float x) {
    //return smoothstep (edge0, edge1, x);
    float y = linearStep (edge0, edge1, x);
    return (y < INFLECTION_PT) ? (hermite (INFLECTION_PT) * y / INFLECTION_PT) : hermite(y);
}

float sunVisible (const in vec4 moonPosition, const in vec4 sunPosition) {
    // compute an estimate of the visibility of the sun as a function of the moon as a blocker

    // the positions are reported in 4d space as a 3d location , with the 4th dimension as the
    // radius, start by projecting them for the current fragment

    vec3 sunDelta = v3 (sunPosition) - model;
    float sunDeltaLength = length (sunDelta);
    vec3 A = v3 (moonPosition);
    vec3 moonDelta = A - model;
    float moonDeltaLength = length (moonDelta);
    float projectionRatio = moonDeltaLength / sunDeltaLength;
    vec3 B = model + (sunDelta * projectionRatio);

    // compute the delta and radius values that we'll need
    float d = length (B - A);
    float rA = moonPosition.w;
    float rB = sunPosition.w * projectionRatio;

    // we'll need the areas of the two circles
    float aArea = rA * rA * PI;
    float bArea = rB * rB * PI;

    // compute my interpolated shortcut approximation
    float baseline = max (0.0, (bArea - aArea) / bArea);
    float edge0 = abs (rA - rB);
    float edge1 = rA + rB;
    float visibility = baseline + (mystep(edge0, edge1, d) * (1.0 - baseline));
    return visibility;

/*
    // if the circles are disjoint, the source is completely visible, this is probably most of the
    // time, so we want to early out as much as possible
    if (d >= rA + rB) {
        return 1.0;
    }

    // if one of the circles is completely contained, there is no intersection point
    float rDelta = rA - rB;//
    if ((rDelta < 0.0) && (d < -rDelta)) {
        // the blocker is smaller than the source and is contained
        return (bArea - aArea) / bArea;
    } else if (d <= rDelta) {
        // the blocker is larger than the source, or exactly the same size
        return 0.0;
    }

    // compute the lens intersection point, and the height of the chord
    float a = ((rA * rA) - (rB * rB) + (d * d)) / (2.0 * d);
    float b = d - a;
    float c = sqrt ((rA * rA) - (a * a));

    // compute the angle of the wedge on A, and the area of the subtended wedge as a fraction of the circle
    float thetaA = atan(c, a);
    float wedgeAreaA = aArea * (thetaA / PI);
    float lensAreaA = wedgeAreaA - (a * c);

    // compute the angle of the wedge on B, and the area of the subtended wedge as a fraction of the circle
    float thetaB = atan (c, b);
    float wedgeAreaB = bArea * (thetaB / PI);
    float lensAreaB = wedgeAreaB - (b * c);

    // return the area of the source minus the area of the intersection
    return (bArea - (lensAreaA + lensAreaB)) / bArea;
*/
}

vec3 multiplyColors (const in vec3 left, const in vec3 right) {
    vec3 result = vec3 (left.r * right.r, left.g * right.g, left.b * right.b);
    return result;
}

vec3 screenColor (const in vec3 left, const in vec3 right) {
    vec3 one = vec3 (1.0, 1.0, 1.0);
    vec3 result = one - (multiplyColors (one - left, one - right));
    return result;
}

vec3 smoothmix (const in vec3 a, const in vec3 b, const in float t) {
    return mix (a, b, smoothstep (0.0, 1.0, t));
}

void main(void) {
    // compute the core vectors we'll need
	vec3 viewVector = normalize (cameraPosition - model);
    vec3 normalVector = normalize ((normalMatrix * vec4 (normal, 0.0)).xyz);

    // standard cosines we'll need
	float cosLightNormalAngle = dot(normalVector, lightDirection);
	float cosViewNormalAngle = dot(normalVector, viewVector);

    // the mapping from day to night
    float daytimeScale = clamp((cosLightNormalAngle + 0.2) * 2.5, 0.0, 1.0) * sunVisible (moonPosition, sunPosition);
    daytimeScale *= daytimeScale;

    // get the texture map day color. The maps we are using (from Blue Marble at
    // http://visibleearth.nasa.gov/view_cat.php?categoryID=1484&p=1) are very saturated, so we
    // screen in a bit of a hazy blue based on images from EPIC (http://epic.gsfc.nasa.gov/)
    vec3 dayTxColor = texture2D(dayTxSampler, texture).rgb;
    vec3 hazyBlue = vec3(0.04, 0.07, 0.12);
    dayTxColor = screenColor (dayTxColor, hazyBlue);

    // get the texture map night color, scaled to black as the view angle fades away
    vec3 nightTxColor = texture2D(nightTxSampler, texture).rgb;
    nightTxColor = nightTxColor * cosViewNormalAngle;

    // the two colors are blended by the daytime scale
    vec3 groundColor = smoothmix (nightTxColor, dayTxColor, sqrt (daytimeScale));

    // compute the specular contribution
    float specularExp = 8.0;
    vec3 reflection = reflect(-lightDirection, normalVector);
    float specularMultiplier = clamp(dot(reflection, viewVector), 0.0, 1.0);
    float specularMapTxValue = texture2D(specularMapTxSampler, texture).r;
    vec3 specularColor = vec3(1.0, 0.9, 0.8) * (pow(specularMultiplier, specularExp) * 0.3 * specularMapTxValue);

    vec3 finalColor = clamp (groundColor + specularColor, 0.0, 1.0);

    gl_FragColor = vec4 (finalColor, outputAlpha);
}
