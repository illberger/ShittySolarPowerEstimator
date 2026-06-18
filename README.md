# Shitty Solar Power Estimator

This is a derivative of the following Solar Position works:
- https://github.com/xeqlol/SolarPositionAlgorithm
- https://midcdmz.nlr.gov/spa/ (Licensed original)

### WTF?

Computes the position of the sun for any location and time using the NREL Solar Position Algorithm (Reda & Andreas, 2003), accurate to ±0.0003°. From the solar position it estimates the output of a solar panel array accounting for panel tilt, azimuth, and atmospheric refraction.
The 3D globe shows the Earth's rotation relative to the sun; the Earth's orientation is derived from Greenwich Sidereal Time as computed by the SPA.

The irradiance is just an estimate, as it is only computed by the panel orientation relative to the SP.
