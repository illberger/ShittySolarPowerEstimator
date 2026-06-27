# Shitty Solar Power Estimator

This is a derivative of the following <b>Solar Position</b> works:
- https://github.com/xeqlol/SolarPositionAlgorithm
- https://midcdmz.nlr.gov/spa/ (Licensed original)

### 1. WTF?

Computes the position of the sun for a location and time using the NREL Solar Position Algorithm (Reda & Andreas, 2003). 

### 2. WTF?
If weather data is present, hourly irradiances go into a 3-component Plane of Array (POA) eq.:
- Beam: Direct sun adjusted for the panel's angle of incidence
- Diffuse: Scattered sky light scaled by the panel tilt 
- Reflected: Harcoded 0.2

The final POA is used to to spit out estimated output (W) of observers solar panels, handling either STC-ratings or surface area mode. 

User can make some noncritical assumptions about system efficiency which includes essentially all losses except optical loss.
