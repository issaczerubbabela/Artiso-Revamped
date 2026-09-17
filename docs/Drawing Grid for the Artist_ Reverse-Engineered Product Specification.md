# **Stage 1 – Project Overview & Application Architecture**

**Application:** Drawing Grid for the Artist v3.0.6 (Android)  
**Author:** Nguyen  
**Document Type:** Reverse-Engineered Product Specification (Stage 1\)

---

# **1\. Purpose of the Application**

Drawing Grid for the Artist is a reference-assisted drawing application that helps artists accurately transfer an image onto physical or digital media using a customizable grid system and image preprocessing tools.

Unlike a traditional image editor, the application is designed around a single workflow:

> **Import → Prepare → Grid → Draw → Export/Save**

The application minimizes distractions and focuses almost entirely on assisting observational drawing rather than creating artwork digitally.

---

# **2\. Target Audience**

The application appears to target five primary user groups.

## **Beginner Artists**

Users learning proportions using the grid method.

Needs:

* Easy image import  
* Large visible grids  
* Simple controls

---

## **Hobby Artists**

People drawing portraits and landscapes occasionally.

Needs:

* Image adjustments  
* Multiple grid styles  
* Print-ready grids

---

## **Professional Artists**

Artists creating commissioned portraits.

Needs:

* Accurate grids  
* Precise image alignment  
* High-resolution references  
* Fast workflow

---

## **Art Teachers**

Teachers demonstrating grid drawing.

Needs:

* Large grids  
* Numbered coordinates  
* Classroom-friendly interface

---

## **Students**

School and college students practicing realistic drawing.

Needs:

* Low learning curve  
* Fast setup  
* Minimal configuration

---

# **3\. Core Philosophy**

From the observed interface and workflow, the app follows several consistent design principles:

### **Simplicity First**

Most operations require only one or two taps.

---

### **Drawing-Centric**

The image remains the primary focus. UI controls are secondary and occupy minimal screen space.

---

### **Non-Destructive Editing**

Image adjustments do not permanently modify the original image.

---

### **Immediate Feedback**

Changing sliders updates the image in real time.

---

### **Sequential Workflow**

The interface guides users through a natural progression rather than exposing every feature simultaneously.

---

# **4\. High-Level Workflow**

Launch App  
      │  
      ▼  
Import Image  
      │  
      ▼  
Crop / Rotate  
      │  
      ▼  
Adjust Image  
      │  
      ▼  
Apply Grid  
      │  
      ▼  
Customize Grid  
      │  
      ▼  
Zoom / Pan  
      │  
      ▼  
Use as Drawing Reference  
      │  
      ▼  
Save / Export

---

# **5\. Functional Modules**

Based on the screen recording and application structure, the app can be divided into the following modules:

## **Module 1 – Image Import**

Responsibilities:

* Open Gallery  
* Load image  
* Handle image orientation  
* Prepare editing workspace

---

## **Module 2 – Image Editing**

Responsibilities:

* Crop  
* Rotate  
* Flip  
* Resize display  
* Prepare image

---

## **Module 3 – Image Processing**

Responsibilities:

* Brightness  
* Contrast  
* Saturation  
* Artistic filters  
* Edge enhancement

---

## **Module 4 – Grid Engine**

Responsibilities:

* Generate grid  
* Number cells  
* Draw lines  
* Configure spacing  
* Configure colors  
* Configure thickness

---

## **Module 5 – Workspace**

Responsibilities:

* Zoom  
* Pan  
* Compare  
* Reference viewing

---

## **Module 6 – Export**

Responsibilities:

* Save image  
* Export grid  
* Share

---

# **6\. Information Architecture**

Application

├── Home  
│  
├── Image Import  
│  
├── Editing Workspace  
│     ├── Crop  
│     ├── Rotate  
│     ├── Flip  
│     ├── Adjustments  
│     ├── Filters  
│     └── Grid  
│  
├── Settings  
│  
└── Export

The application is relatively shallow, favoring direct access over deeply nested menus.

---

# **7\. Navigation Architecture**

The navigation is **task-oriented** rather than section-oriented.

Users generally remain within a single editing workspace, invoking tools via overlays or dialogs instead of navigating between separate screens. This reduces context switching and keeps the drawing visible.

---

# **8\. UX Design Principles Observed**

### **Strengths**

* Large canvas area.  
* Minimal UI clutter.  
* Logical workflow.  
* Fast image loading.  
* Easy to understand for first-time users.  
* Immediate visual feedback.  
* Touch-friendly controls.

### **Weaknesses**

* Some icons lack labels, making discoverability difficult.  
* Advanced features are not grouped by workflow.  
* Limited onboarding for new users.  
* Settings organization could be more hierarchical.

---

# **9\. Initial Screen Inventory**

From the recording, the following screens or major states are identifiable:

1. Splash / Launch  
2. Main Workspace  
3. Gallery Picker  
4. Crop Screen  
5. Grid Configuration  
6. Filter Panel  
7. Image Adjustment Panel  
8. Settings Dialog  
9. Export / Save  
10. Help / About (if present in APK)

Subsequent stages will document each of these in detail.

---

# **10\. Architectural Interpretation**

Although the source code has not yet been fully analyzed, the application's behavior suggests a modular pipeline:

Gallery  
      │  
Bitmap Loader  
      │  
Image Processor  
      │  
Grid Generator  
      │  
Canvas Renderer  
      │  
Touch Controller  
      │  
Export Engine

This separation allows image modifications and grid rendering to remain independent, making the grid overlay effectively non-destructive.

---

# **11\. Competitive Positioning**

Compared to general image editors, Drawing Grid for the Artist emphasizes **reference preparation** rather than creative editing.

Compared to professional digital art applications, it offers a narrower but more focused workflow centered on observational drawing. Its simplicity reduces the learning curve but also limits advanced capabilities such as layers, perspective guides, or project management.

---

# **12\. Opportunities for Improvement (High-Level)**

Several areas stand out as candidates for enhancement:

* Introduce a guided onboarding experience for first-time users.  
* Group related tools into clearer categories (Image, Grid, Export, Settings).  
* Add search or quick-access for frequently used options.  
* Improve icon discoverability with optional labels or tooltips.  
* Support project-based workflows with recent files and folders.  
* Expand grid options to include perspective, radial, and proportional guides.  
* Add cloud backup and cross-device synchronization.  
* Provide accessibility options such as adjustable UI scaling and high-contrast themes.

---

# **Stage 2 – Complete UI Documentation**

**Application:** Drawing Grid for the Artist v3.0.6 (Android)  
**Document Type:** Reverse-Engineered Product Specification (Stage 2\)

---

# **2.1 UI Design Philosophy**

The application's interface follows a **Canvas-First** philosophy. Unlike photo editors that emphasize tool palettes, the drawing reference remains the primary focus at nearly all times.

### **Design Goals**

* Maximize visible drawing area.  
* Minimize persistent UI chrome.  
* Keep editing operations modal and temporary.  
* Reduce the number of taps required for common tasks.  
* Allow artists to concentrate on the reference image rather than the interface.

---

# **2.2 Overall Navigation Model**

The application does **not** use multiple independent pages. Instead, it relies on a **single editing workspace** where tools appear as overlays, bottom sheets, or dialogs.

App Launch  
     │  
     ▼  
Main Workspace  
     │  
 ┌───┼───────────────────────────────────────┐  
 │   │               │            │          │  
 ▼   ▼               ▼            ▼          ▼  
Import Image     Grid Tools   Filters   Adjustments  Settings  
                      │            │           │  
                      └────────────┴───────────┘  
                               │  
                               ▼  
                        Main Workspace

This minimizes navigation overhead and preserves the user's context.

---

# **2.3 Screen Inventory**

Based on the APK and recording, the primary interface states include:

| Screen | Purpose |
| ----- | ----- |
| Splash Screen | App initialization |
| Main Workspace | Central editing canvas |
| Image Import | Select image from device |
| Crop Tool | Crop and reposition image |
| Rotate & Flip | Correct image orientation |
| Filter Panel | Artistic and tonal preprocessing |
| Image Adjustment Panel | Brightness, contrast, saturation, etc. |
| Grid Configuration | Configure grid appearance |
| Save/Export | Save processed image |
| Settings | Application preferences |
| About/Help | Information and support (if available) |

---

# **2.4 Splash Screen**

### **Purpose**

Initialize the application while loading assets.

### **Components**

* Application logo  
* Application title  
* Loading state (if present)

### **UX Notes**

The splash screen is intentionally brief and serves primarily as a branding and initialization screen.

---

# **2.5 Main Workspace (Core Screen)**

This is the primary interface where users spend most of their time.

## **Layout**

──────────────────────────────  
Top Toolbar  
──────────────────────────────

Image Canvas  
(Grid Overlay)

Bottom Controls  
──────────────────────────────

The layout dedicates the majority of screen space to the image canvas.

---

# **2.6 Canvas Area**

### **Purpose**

Displays the imported image along with any active grid overlays and image adjustments.

### **Supported Interactions**

* Pinch to zoom  
* Pan  
* Tap to activate controls (where applicable)

The canvas updates in real time as users modify settings.

---

# **2.7 Top Toolbar**

The toolbar provides access to high-level operations.

Observed functions include:

* Import/Open Image  
* Undo/Reset (where available)  
* Save  
* Settings  
* Additional options menu

### **Design Characteristics**

* Compact icons.  
* Minimal text labels.  
* Persistent across editing sessions.

---

# **2.8 Bottom Toolbar**

The bottom section exposes context-sensitive editing tools.

Typical categories observed:

* Grid  
* Filters  
* Adjustments  
* Crop  
* Rotate  
* Flip

The toolbar changes depending on the active editing mode.

---

# **2.9 Image Import Workflow**

Open App  
     │  
     ▼  
Import Image  
     │  
     ▼  
Gallery Picker  
     │  
     ▼  
Selected Image  
     │  
     ▼  
Editing Workspace

The workflow is straightforward and optimized for quickly beginning a drawing session.

---

# **2.10 Crop Interface**

### **Purpose**

Prepare the reference image before grid generation.

### **Available Operations**

* Crop boundaries  
* Reposition image  
* Maintain aspect ratio (where supported)  
* Confirm  
* Cancel

### **UX Notes**

Cropping is one of the earliest steps in the workflow to ensure the grid aligns with the final composition.

---

# **2.11 Rotate & Flip Interface**

Provides orientation correction.

Observed operations:

* Rotate clockwise  
* Rotate counterclockwise  
* Horizontal flip  
* Vertical flip (if supported)

These operations are destructive to the displayed orientation but preserve the original source image.

---

# **2.12 Filter Panel**

The filter panel focuses on improving the usefulness of the reference image for drawing rather than artistic effects.

Typical objectives include:

* Simplifying values  
* Enhancing edges  
* Increasing contrast  
* Reducing distracting colors

Each filter provides immediate visual feedback.

A detailed breakdown of every filter will be provided in **Stage 4**.

---

# **2.13 Image Adjustment Panel**

This panel contains continuous controls (typically sliders) for modifying image properties.

Observed adjustment categories include:

* Brightness  
* Contrast  
* Saturation  
* Additional tonal adjustments (depending on mode)

Users can preview changes instantly before applying them.

---

# **2.14 Grid Configuration Panel**

One of the application's central interfaces.

Responsibilities include:

* Grid size  
* Number of rows  
* Number of columns  
* Grid color  
* Line thickness  
* Numbering options  
* Visibility controls

This panel will be fully documented in **Stage 3**.

---

# **2.15 Save / Export Interface**

Provides options for preserving the prepared reference image.

Likely operations:

* Save to gallery  
* Overwrite current project  
* Export grid image  
* Share image

The interface is intentionally simple to reduce friction at the end of the workflow.

---

# **2.16 Settings Screen**

The settings screen centralizes application-wide preferences.

Observed categories include:

* General behavior  
* Display preferences  
* Grid defaults  
* Theme (if supported)  
* Help/About

A detailed explanation of each option will be provided in **Stage 5**.

---

# **2.17 Dialog Patterns**

The application primarily uses modal dialogs for confirmation and configuration.

Common dialog types include:

* Confirmation dialogs  
* Save dialogs  
* Reset dialogs  
* Grid configuration dialogs  
* Image adjustment panels

These dialogs temporarily suspend interaction with the canvas until dismissed.

---

# **2.18 Navigation Characteristics**

### **Strengths**

* Minimal navigation depth.  
* Users rarely leave the editing workspace.  
* Quick access to frequently used tools.  
* Immediate return to the canvas after completing an action.

### **Weaknesses**

* Some advanced tools may be difficult to discover due to icon-only representation.  
* Lack of breadcrumb or workflow indicators.  
* New users may require experimentation to locate specific functions.

---

# **2.19 Interaction Model**

The application supports several touch interactions:

| Interaction | Function |
| ----- | ----- |
| Tap | Activate tool or button |
| Drag | Pan image or adjust crop |
| Pinch | Zoom in/out |
| Slider drag | Modify image parameters |
| Long press | Limited or context-dependent |

The interaction model is optimized for one-handed tablet or smartphone use.

---

# **2.20 UI Consistency**

The interface demonstrates consistent use of:

* Iconography  
* Dialog layouts  
* Toolbar placement  
* Editing workflow  
* Immediate visual feedback

However, opportunities exist to improve consistency through clearer grouping of related tools and optional text labels.

---

# **2.21 Preliminary UI Improvement Suggestions**

Based on the observed interface, several enhancements could improve usability:

* Optional text labels beneath toolbar icons.  
* Customizable toolbar with favorite tools.  
* Searchable settings.  
* Context-sensitive help overlays.  
* Recent projects screen.  
* Multi-step undo/redo history.  
* Gesture customization.  
* Split-screen reference mode.  
* Dark and light theme options.  
* Tablet-specific layout optimization.

---

# **Stage 3 – Drawing Grid Engine**

**Application:** Drawing Grid for the Artist v3.0.6 (Android)  
**Document Type:** Reverse-Engineered Product Specification (Stage 3\)

---

# **3.1 Overview**

The Grid Engine is the core subsystem of the application. Unlike a simple image overlay, it provides a configurable spatial reference system that assists artists in accurately transferring proportions from a reference image to a drawing surface.

The grid serves as a visual coordinate framework while preserving the integrity of the underlying image.

---

# **3.2 Objectives of the Grid Engine**

The engine is designed to:

* Divide an image into measurable sections.  
* Preserve proportions between the reference and drawing.  
* Reduce estimation errors.  
* Assist with placement of complex features.  
* Improve drawing accuracy.  
* Enable progressive drawing one cell at a time.

---

# **3.3 Grid Rendering Pipeline**

Reference Image  
       │  
       ▼  
Image Dimensions  
       │  
       ▼  
Grid Calculation  
       │  
       ▼  
Cell Generation  
       │  
       ▼  
Numbering  
       │  
       ▼  
Line Rendering  
       │  
       ▼  
Canvas Overlay

The grid is rendered as an overlay layer, allowing image adjustments and grid settings to remain independent.

---

# **3.4 Grid Coordinate System**

The application logically treats the image as a two-dimensional matrix.

Example:

     A     B     C     D

1   ┌────┬────┬────┬────┐  
    │    │    │    │    │  
2   ├────┼────┼────┼────┤  
    │    │    │    │    │  
3   ├────┼────┼────┼────┤  
    │    │    │    │    │  
4   └────┴────┴────┴────┘

Each cell acts as a localized reference area, simplifying the drawing process.

---

# **3.5 Grid Generation Process**

Internally, grid generation consists of several sequential steps:

1. Determine image width and height.  
2. Calculate drawable canvas boundaries.  
3. Divide the image into rows.  
4. Divide the image into columns.  
5. Compute cell dimensions.  
6. Render vertical lines.  
7. Render horizontal lines.  
8. Apply labels (if enabled).  
9. Display overlay.

---

# **3.6 Cell Dimension Calculation**

The engine conceptually computes cell size using:

* Cell Width \= Image Width ÷ Number of Columns  
* Cell Height \= Image Height ÷ Number of Rows

This ensures each grid cell maintains consistent proportions across the image.

---

# **3.7 Grid Density**

The application supports varying grid densities to accommodate different levels of drawing precision.

### **Low Density**

Characteristics:

* Fewer cells.  
* Faster setup.  
* Suitable for beginners.  
* Ideal for large subjects.

Advantages:

* Less visual clutter.  
* Easier navigation.

Limitations:

* Lower positional accuracy.

---

### **Medium Density**

Characteristics:

* Balanced number of cells.  
* Suitable for portraits.  
* General-purpose use.

Advantages:

* Good compromise between detail and readability.

---

### **High Density**

Characteristics:

* Many small cells.  
* Increased precision.  
* Preferred for detailed realism.

Advantages:

* Better feature placement.  
* Reduced proportional error.

Limitations:

* Can obscure portions of the image.  
* May slow manual navigation.

---

# **3.8 Grid Appearance Controls**

The engine allows visual customization of the grid to suit different reference images.

Configurable attributes include:

* Grid visibility.  
* Line color.  
* Line thickness.  
* Cell count.  
* Numbering visibility.

These options improve contrast and readability across light and dark images.

---

# **3.9 Grid Color**

The application allows changing the grid color to maximize visibility.

Common use cases:

| Image Background | Recommended Grid Color |
| ----- | ----- |
| White | Black |
| Black | White |
| Colorful | Red or Blue |
| Mid-tone | Yellow |

Future versions could support automatic color selection based on image luminance.

---

# **3.10 Line Thickness**

Adjustable line thickness balances visibility and image clarity.

### **Thin**

* Minimal obstruction.  
* Preferred for experienced artists.

### **Medium**

* General-purpose.

### **Thick**

* Easier to see from a distance.  
* Suitable for classroom demonstrations.

---

# **3.11 Grid Numbering**

The grid engine supports optional cell identifiers.

Purpose:

* Improve communication ("See cell B3").  
* Track drawing progress.  
* Simplify teaching.  
* Facilitate collaborative instruction.

Numbering can typically be enabled or disabled without affecting the underlying grid.

---

# **3.12 Overlay Rendering**

The grid functions as a non-destructive overlay.

Layer order:

Top  
│  
Grid Labels  
│  
Grid Lines  
│  
Reference Image  
│  
Canvas Background  
Bottom

Because the overlay is separate, adjustments to the image do not require regenerating the grid unless dimensions change.

---

# **3.13 Grid Responsiveness**

The grid scales dynamically with user interactions.

Supported behaviors:

* Zoom retains alignment.  
* Pan moves image and grid together.  
* Rotation triggers grid recalculation.  
* Crop regenerates grid to fit new boundaries.

Maintaining synchronization between the image and grid is critical for accuracy.

---

# **3.14 Performance Considerations**

Rendering performance depends on:

* Image resolution.  
* Number of grid cells.  
* Line thickness.  
* Device graphics capabilities.

The current implementation appears optimized for real-time interaction on modern Android devices.

---

# **3.15 Artist Workflow with Grid**

A typical workflow is:

1. Import reference image.  
2. Crop to desired composition.  
3. Adjust image brightness/contrast if needed.  
4. Select an appropriate grid density.  
5. Choose grid color and thickness.  
6. Begin drawing cell by cell.  
7. Zoom for detailed areas.  
8. Save or export the prepared reference.

---

# **3.16 Strengths of the Current Grid Engine**

* Simple and intuitive.  
* Non-destructive overlay.  
* Real-time updates.  
* Customizable appearance.  
* Supports various artistic workflows.  
* Effective for observational drawing.

---

# **3.17 Limitations Observed**

* Limited grid types (primarily rectangular).  
* No adaptive grid spacing.  
* No perspective grids.  
* No radial or circular guides.  
* No vanishing-point assistance.  
* No customizable coordinate systems beyond standard rows and columns.  
* No saved grid presets.  
* Limited annotation capabilities.

---

# **3.18 Proposed Enhancements**

The following features could significantly improve the grid engine:

### **Perspective Grids**

Support for one-point, two-point, and three-point perspective overlays.

---

### **Radial Grids**

Useful for drawing circular objects, faces, and mandalas.

---

### **Golden Ratio Overlay**

Assist artists in composing aesthetically balanced images.

---

### **Rule of Thirds**

A quick composition guide for photographers and artists.

---

### **Dynamic Grid Density**

Automatically increase grid detail in regions with higher visual complexity while keeping simpler areas less cluttered.

---

### **Custom Coordinate Labels**

Allow users to choose:

* Numbers only  
* Letters only  
* Alphanumeric (A1, B2, etc.)  
* Roman numerals  
* Symbols

---

### **Layered Grids**

Support multiple simultaneous overlays, such as:

* Major grid (coarse)  
* Minor grid (fine)  
* Perspective guide  
* Proportion guide

---

### **Grid Presets**

Enable users to save frequently used configurations (e.g., "Portrait Fine Grid," "Landscape Medium Grid") for quick access.

---

### **Live Camera Grid**

Overlay the selected grid directly on the camera preview to assist with plein air sketching or observational drawing from life.

---

# **3.19 Technical Assessment**

The current grid engine is well-suited for its intended purpose of aiding accurate observational drawing. Its non-destructive overlay model and responsive behavior provide a solid foundation. However, expanding the range of grid types and introducing intelligent, context-aware features would elevate the application from a capable utility to a more comprehensive professional drawing aid.

---

# **Stage 4 – Image Processing & Filters**

**Application:** Drawing Grid for the Artist v3.0.6 (Android)  
**Document Type:** Reverse-Engineered Product Specification (Stage 4\)

---

# **4.1 Overview**

Unlike traditional photo-editing applications, the image processing system in **Drawing Grid for the Artist** is designed to improve the *readability* of a reference image rather than its aesthetic quality.

The objective is to help artists identify:

* Major forms  
* Edges  
* Value relationships  
* Shadow shapes  
* Proportions  
* Fine details

The processing pipeline is non-destructive, allowing artists to experiment with different adjustments without altering the original image.

---

# **4.2 Image Processing Pipeline**

Original Image

      │

      ▼

Crop / Rotate / Flip

      │

      ▼

Global Image Adjustments

      │

      ▼

Filter Processing

      │

      ▼

Grid Overlay

      │

      ▼

Zoom / Pan

      │

      ▼

Display

This sequence ensures that filters are applied before the grid is rendered, keeping the overlay independent of image transformations.

---

# **4.3 Design Philosophy**

The processing tools prioritize:

* Visibility over artistic enhancement.  
* Speed over complexity.  
* Immediate visual feedback.  
* Minimal user configuration.

Each adjustment updates the canvas in real time, enabling artists to fine-tune the reference image interactively.

---

# **4.4 Categories of Image Processing**

The processing tools can be grouped into four categories:

| Category | Purpose |
| ----- | ----- |
| Tonal Adjustments | Modify brightness and contrast |
| Color Adjustments | Control saturation and color intensity |
| Structural Filters | Highlight edges and forms |
| Artistic Simplification | Reduce visual complexity for easier drawing |

---

# **4.5 Brightness Adjustment**

## **Purpose**

Controls the overall luminance of the image.

### **When to Use**

* Dark photographs.  
* Underexposed references.  
* Low-light portraits.

### **Benefits**

* Reveals hidden shadow details.  
* Improves visibility of subtle forms.

### **Risks**

Excessive brightness may:

* Wash out highlights.  
* Reduce value separation.  
* Make edges less distinct.

### **Recommended Usage**

* Portraits: Slight increase if facial details are obscured.  
* Landscapes: Minimal adjustment to preserve contrast.

---

# **4.6 Contrast Adjustment**

## **Purpose**

Increases or decreases the difference between light and dark areas.

### **Low Contrast**

* Softer transitions.  
* Better for smooth shading studies.

### **High Contrast**

* Stronger edges.  
* Clear shadow boundaries.  
* Easier shape identification.

### **Benefits**

* Simplifies value grouping.  
* Enhances readability.

### **Risks**

Excessive contrast can clip highlights and shadows, removing important detail.

---

# **4.7 Saturation Adjustment**

## **Purpose**

Controls color intensity.

### **High Saturation**

* Vivid colors.  
* Useful for color painting.

### **Low Saturation**

* Reduces distractions.  
* Helps focus on values and form.

### **Typical Artistic Use**

Most graphite artists benefit from reducing saturation to emphasize tonal relationships over color.

---

# **4.8 Edge Enhancement**

## **Purpose**

Accentuates transitions between adjacent regions.

### **Benefits**

* Facial feature clarity.  
* Hair definition.  
* Clothing folds.  
* Architectural details.

### **Limitations**

Overuse may introduce noise and emphasize insignificant texture.

---

# **4.9 Grayscale Conversion**

## **Purpose**

Removes color information while preserving luminance.

### **Benefits**

* Simplifies the image.  
* Encourages value-based drawing.  
* Ideal for charcoal and graphite work.

### **Typical Use Cases**

* Portrait studies.  
* Classical realism.  
* Academic drawing exercises.

---

# **4.10 Threshold / High-Contrast Mode**

## **Purpose**

Converts the image into distinct light and dark regions.

### **Applications**

* Tattoo design.  
* Silhouette studies.  
* Poster art.  
* Value block-in.

### **Benefits**

* Simplifies complex references.  
* Highlights dominant shapes.

### **Limitations**

Fine tonal transitions are lost.

---

# **4.11 Pencil Sketch Simulation**

## **Purpose**

Transforms the image into a sketch-like reference.

### **Benefits**

* Highlights contours.  
* Suggests line work.  
* Reduces photographic distractions.

### **Best For**

* Beginners learning contour drawing.  
* Quick sketch practice.  
* Illustration planning.

---

# **4.12 Blur Reduction / Sharpening**

## **Purpose**

Enhances perceived detail by increasing local contrast around edges.

### **Benefits**

* Clarifies fine textures.  
* Improves facial detail.  
* Assists with intricate subjects.

### **Risks**

Excessive sharpening may create halos or amplify image noise.

---

# **4.13 Noise Considerations**

Photographs often contain sensor noise, especially in low-light conditions.

A future enhancement could include selective noise reduction before edge detection to improve clarity.

---

# **4.14 Histogram Interpretation (Suggested Feature)**

Although not present in the current version, a histogram would help artists understand the tonal distribution of the reference image.

### **Benefits**

* Detect clipping.  
* Balance exposure.  
* Improve value studies.

---

# **4.15 Real-Time Preview**

One of the application's strengths is its immediate visual feedback.

As users adjust sliders or apply filters:

* The processed image updates instantly.  
* The grid remains synchronized.  
* Artists can compare different settings efficiently.

---

# **4.16 Filter Workflow**

A recommended workflow is:

1. Import image.  
2. Correct orientation.  
3. Crop composition.  
4. Adjust brightness.  
5. Fine-tune contrast.  
6. Reduce saturation (if drawing in monochrome).  
7. Apply structural filters as needed.  
8. Generate grid.  
9. Begin drawing.

---

# **4.17 Recommended Settings by Medium**

| Medium | Brightness | Contrast | Saturation | Notes |
| ----- | ----- | ----- | ----- | ----- |
| Graphite | Slight ↑ | Medium–High | Low | Emphasize values |
| Charcoal | Medium | High | Very Low | Strong shadow masses |
| Colored Pencil | Neutral | Medium | Medium | Preserve color relationships |
| Watercolor | Neutral | Medium | Medium–High | Maintain color harmony |
| Oil Painting | Neutral | Medium | High | Retain color richness |
| Acrylic | Neutral | Medium | High | Similar to oil workflows |

---

# **4.18 Performance Considerations**

Real-time image processing performance depends on:

* Image resolution.  
* Number of active filters.  
* Device GPU/CPU capabilities.  
* Memory bandwidth.

The application appears optimized for responsive interaction on contemporary Android hardware.

---

# **4.19 Current Strengths**

* Immediate preview.  
* Artist-focused processing.  
* Simple adjustment controls.  
* Non-destructive workflow.  
* Integration with the grid overlay.

---

# **4.20 Current Limitations**

Based on the observed interface:

* Limited filter variety.  
* No local (brush-based) adjustments.  
* No selective color editing.  
* No histogram.  
* No curves adjustment.  
* No levels adjustment.  
* No masking.  
* No filter presets.  
* No before/after split view.  
* No adjustment history.

---

# **4.21 Proposed Enhancements**

## **AI Edge Detection**

Use machine learning to distinguish meaningful contours (facial features, object boundaries) from noise, producing cleaner drawing references.

---

## **Adaptive Value Simplification**

Automatically group tones into a user-defined number of value levels (e.g., 3, 5, or 7), aiding painters in planning value structures.

---

## **Shadow Mapping**

Generate a simplified map of shadow shapes to help artists establish major masses before adding detail.

---

## **Detail Density Slider**

Allow users to control how much fine detail is preserved versus simplified, tailoring the reference to different drawing stages.

---

## **Color Palette Extraction**

Analyze the image and display its dominant colors, useful for painters working in traditional media.

---

## **Skin Tone Isolation**

Highlight skin regions independently, assisting portrait artists in studying facial planes and proportions.

---

## **Reference Comparison Mode**

Enable side-by-side or split-screen comparison between the original image and the processed version.

---

## **Preset Library**

Include predefined processing profiles such as:

* Portrait Study  
* Graphite Sketch  
* Charcoal Study  
* Oil Painting  
* Watercolor  
* Manga  
* Architectural Drawing  
* Animal Fur Study

---

## **Adjustment Presets**

Allow users to save and reuse custom adjustment combinations across multiple projects.

---

## **AI Smart Recommendation**

Analyze the imported image and suggest optimal filter settings based on subject type (portrait, landscape, architecture, still life, etc.).

---

# **4.22 Technical Assessment**

The image processing system is intentionally streamlined, emphasizing clarity and ease of use over exhaustive editing capabilities. Its real-time, non-destructive workflow aligns well with the application's purpose as a drawing aid. However, introducing intelligent simplification tools, richer adjustment options, and reusable presets would significantly enhance its value for both beginners and professional artists.

---

# **Stage 5 – Complete Settings Documentation**

**Application:** Drawing Grid for the Artist v3.0.6 (Android)  
**Document Type:** Reverse-Engineered Product Specification (Stage 5\)

---

# **5.1 Overview**

The **Settings System** is the application's configuration center. While most features are accessed directly through the editing workspace, the settings determine the application's default behavior, visual preferences, and workflow.

The settings can be categorized into four groups:

1. Application Preferences  
2. Grid Preferences  
3. Image Processing Preferences  
4. Export & Storage Preferences

A well-designed settings system should minimize repetitive configuration by allowing artists to establish reusable defaults.

---

# **5.2 Settings Architecture**

Settings

│

├── General

├── Workspace

├── Grid

├── Image Processing

├── Display

├── Export

├── Storage

├── Help

└── About

Currently, the application presents a relatively flat settings structure. A more hierarchical organization could improve discoverability as the feature set grows.

---

# **5.3 General Settings**

## **Default Startup Behavior**

### **Purpose**

Determines what the application displays upon launch.

### **Possible Options**

* Open blank workspace.  
* Resume previous project.  
* Show recent files.  
* Open image picker immediately.

### **Recommendation**

Remember the user's last workflow and restore the previous session automatically.

---

## **Auto Save**

### **Purpose**

Periodically saves the current project state.

### **Benefits**

* Prevents accidental data loss.  
* Enables recovery after unexpected app termination.

### **Suggested Options**

* Off  
* Every 1 minute  
* Every 5 minutes  
* Every 10 minutes  
* On every edit

---

## **Confirm Before Exit**

### **Purpose**

Warns users before closing an unsaved project.

### **Recommendation**

Enabled by default to prevent accidental loss of work.

---

# **5.4 Workspace Settings**

## **Zoom Behavior**

Determines how zoom interactions behave.

Possible options:

* Free Zoom  
* Fixed Zoom Steps  
* Fit to Screen  
* Remember Previous Zoom

---

## **Pan Sensitivity**

Controls the responsiveness of image movement.

Use Cases:

* Small phone displays.  
* Large tablets.  
* Stylus users.

---

## **Double Tap Action**

Possible assignments:

* Zoom In  
* Zoom Out  
* Reset Zoom  
* Toggle Grid  
* Toggle Original Image

---

## **Gesture Lock**

Temporarily disables accidental panning or zooming while drawing from the reference.

---

# **5.5 Grid Settings**

This section defines the default appearance and behavior of the grid.

---

## **Default Grid Size**

Purpose:

Specifies the initial number of rows and columns when a new image is imported.

Example presets:

* 4 × 4  
* 6 × 6  
* 8 × 8  
* 10 × 10  
* 12 × 12  
* Custom

---

## **Grid Color**

Possible values:

* Black  
* White  
* Red  
* Blue  
* Green  
* Yellow  
* Custom Color Picker

Future enhancement:

Automatic color selection based on image luminance.

---

## **Grid Opacity**

Controls transparency.

Advantages:

* High opacity for classroom demonstrations.  
* Low opacity for detailed portrait work.

Suggested range:

0–100%

---

## **Line Thickness**

Options:

* Very Thin  
* Thin  
* Medium  
* Thick  
* Extra Thick

---

## **Grid Numbering**

Possible modes:

* Disabled  
* Row Numbers  
* Column Letters  
* Alphanumeric (A1, B2...)  
* Roman Numerals  
* Custom Labels

---

## **Grid Visibility**

Allows quick hiding/showing without deleting the configuration.

---

## **Snap Grid to Image**

Ensures the grid always aligns with image boundaries after transformations.

---

# **5.6 Image Processing Settings**

These settings define default behavior for image adjustments.

---

## **Default Brightness**

Remember the preferred brightness value for new projects.

---

## **Default Contrast**

Stores a preferred contrast setting.

---

## **Default Saturation**

Useful for artists who always draw in grayscale.

---

## **Default Filter**

Possible options:

* None  
* Grayscale  
* High Contrast  
* Pencil Sketch  
* Edge Enhancement

---

## **Live Preview**

Options:

* Enabled  
* Disabled

Disabling live preview may improve performance on low-end devices.

---

# **5.7 Display Settings**

## **Theme**

Potential options:

* Light  
* Dark  
* System Default

---

## **Canvas Background**

Possible colors:

* White  
* Gray  
* Black  
* Transparent Checkerboard

---

## **Toolbar Size**

Options:

* Compact  
* Medium  
* Large

Large icons benefit tablet users and those with accessibility needs.

---

## **Text Size**

Supports:

* Small  
* Medium  
* Large  
* Extra Large

---

## **High Contrast Mode**

Improves visibility for users with visual impairments.

---

# **5.8 Export Settings**

## **Default Export Format**

Possible options:

* PNG  
* JPEG  
* PDF (future)  
* SVG Grid Overlay (future)

---

## **Image Quality**

Range:

0–100%

Higher quality results in larger file sizes.

---

## **Include Grid**

Options:

* Yes  
* No

Useful for exporting either the prepared reference or the original processed image.

---

## **Include Adjustments**

Determines whether brightness, contrast, and filters are baked into the exported image.

---

## **Watermark**

Potential options:

* None  
* Application Name  
* Custom Watermark

---

# **5.9 Storage Settings**

## **Default Save Location**

Possible destinations:

* Internal Storage  
* Pictures Folder  
* Downloads  
* Custom Directory

---

## **Cache Size**

Allows users to:

* View cache usage.  
* Clear temporary files.  
* Optimize storage.

---

## **Recent Projects**

Options:

* Disable history.  
* Remember last 10 projects.  
* Remember last 50 projects.  
* Unlimited

---

# **5.10 Help & Support**

Expected sections include:

* User Guide  
* FAQ  
* Contact Developer  
* Report Bug  
* Rate Application

---

# **5.11 About Screen**

Contains:

* Application Name  
* Version Number  
* Developer Information  
* License  
* Third-party Libraries  
* Privacy Policy  
* Open Source Notices

---

# **5.12 Settings Dependencies**

Certain settings naturally influence others:

Grid Size

     │

     ├── Cell Size

     ├── Numbering Layout

     └── Rendering Performance

Brightness

     │

     └── Filter Visibility

Theme

     │

     ├── Toolbar Colors

     └── Canvas Appearance

Export Quality

     │

     ├── File Size

     └── Export Time

Understanding these relationships helps prevent conflicting configurations.

---

# **5.13 Current Strengths**

* Minimal configuration required.  
* Easy access to common preferences.  
* Focus on artist-relevant settings.  
* Low cognitive load for beginners.

---

# **5.14 Current Limitations**

Based on the observed application:

* No settings search.  
* No user profiles.  
* No cloud synchronization.  
* No backup or restore.  
* No import/export of preferences.  
* Limited accessibility options.  
* No customization of toolbar layout.  
* No keyboard shortcut support.  
* No stylus-specific preferences.  
* No advanced performance tuning.

---

# **5.15 Proposed Enhancements**

## **Settings Profiles**

Allow users to save complete configurations.

Example profiles:

* Portrait Artist  
* Oil Painter  
* Watercolor  
* Tattoo Design  
* Architecture  
* Classroom Teaching

---

## **Cloud Sync**

Synchronize:

* Grid presets.  
* Settings.  
* Recent projects.  
* Export preferences.

---

## **Workspace Customization**

Allow users to:

* Reorder toolbar icons.  
* Hide unused tools.  
* Pin favorite actions.

---

## **Accessibility Enhancements**

Include:

* Voice guidance.  
* High-contrast themes.  
* Color-blind-friendly palettes.  
* Larger touch targets.  
* Haptic feedback customization.

---

## **Performance Mode**

Options:

* Battery Saver  
* Balanced  
* High Performance

This would adjust rendering quality and live preview behavior based on device capabilities.

---

## **Import / Export Settings**

Enable sharing of complete application configurations between devices or team members.

---

## **Developer Mode**

Expose advanced diagnostics such as:

* Rendering FPS.  
* Memory usage.  
* Image resolution.  
* Grid rendering time.  
* Filter processing time.

Useful for troubleshooting and performance optimization.

---

# **5.16 Technical Assessment**

The current settings system is intentionally streamlined, aligning with the application's philosophy of simplicity. However, as the feature set expands, introducing profiles, customization, accessibility improvements, and synchronization capabilities would greatly enhance usability without compromising ease of use.

---

# **Stage 6 – Complete Filter Reference**

**Application:** Drawing Grid for the Artist v3.0.6 (Android)  
**Document Type:** Reverse-Engineered Product Specification (Stage 6\)

---

# **6.1 Overview**

The **Filter System** is one of the application's defining features. Unlike general-purpose photo editors, these filters are designed to transform a photograph into an effective *drawing reference*.

The goals of the filter system are to:

* Simplify visual information.  
* Reveal underlying structure.  
* Emphasize values over color.  
* Reduce distracting textures.  
* Improve edge visibility.  
* Accelerate the drawing process.

---

# **6.2 Filter Processing Pipeline**

Original Image

      │

      ▼

Color Correction

      │

      ▼

Brightness / Contrast

      │

      ▼

Image Filter

      │

      ▼

Edge Enhancement

      │

      ▼

Grid Overlay

      │

      ▼

Drawing Reference

---

# **6.3 Filter Categories**

The filters can be grouped into six functional categories:

| Category | Purpose |
| ----- | ----- |
| Color Filters | Modify overall color characteristics |
| Tonal Filters | Improve value relationships |
| Structural Filters | Reveal edges and forms |
| Simplification Filters | Reduce visual complexity |
| Artistic Filters | Simulate drawing styles |
| Utility Filters | Prepare images for specific workflows |

---

# **6.4 Original Mode**

## **Purpose**

Displays the imported photograph without any image processing.

### **Best For**

* Oil painting  
* Colored pencil  
* Watercolor  
* Accurate color matching  
* Commission work

### **Advantages**

* Preserves every detail.  
* Natural color relationships.  
* No information loss.

### **Limitations**

* Busy backgrounds may distract.  
* Complex textures can overwhelm beginners.

---

# **6.5 Black & White (Grayscale)**

## **Description**

Removes chromatic information while preserving luminance.

### **Processing**

RGB → Grayscale Conversion

### **Benefits**

* Focuses entirely on value.  
* Eliminates color distractions.  
* Improves understanding of light and shadow.

### **Recommended For**

* Graphite  
* Charcoal  
* Pencil  
* Realistic portrait drawing

---

# **6.6 High Contrast**

## **Description**

Expands the tonal range between dark and light areas.

### **Processing**

* Dark pixels become darker.  
* Bright pixels become brighter.

### **Benefits**

* Easier edge recognition.  
* Better shadow grouping.  
* Faster block-in stage.

### **Drawbacks**

May lose subtle transitions.

---

# **6.7 Low Contrast**

## **Description**

Compresses the tonal range.

### **Benefits**

* Preserves soft gradients.  
* Better for smooth skin rendering.

### **Recommended For**

* Portrait realism.  
* Airbrushing.  
* Watercolor planning.

---

# **6.8 Pencil Sketch Filter**

## **Description**

Attempts to simulate a graphite drawing.

### **Visual Characteristics**

* Strong outlines.  
* Light paper background.  
* Reduced colors.  
* Emphasis on contours.

### **Ideal Users**

* Beginners.  
* Cartoon artists.  
* Illustration students.

---

# **6.9 Edge Detection**

## **Description**

Detects abrupt changes in brightness.

### **Primary Objective**

Reveal object boundaries.

### **Typical Uses**

* Portrait outlines.  
* Hair.  
* Clothing folds.  
* Architecture.

### **Possible Algorithms**

* Sobel  
* Canny  
* Laplacian

(The exact implementation cannot be confirmed without source code.)

---

# **6.10 Inverted Image**

## **Description**

Produces a photographic negative.

### **Uses**

* Charcoal planning.  
* White-on-black artwork.  
* Experimental studies.

---

# **6.11 Threshold Filter**

## **Description**

Converts the image into only black and white pixels.

### **Processing**

Gray Value

↓

Threshold

↓

Black or White

### **Uses**

* Tattoo stencil creation.  
* Shadow studies.  
* Silhouette drawing.

---

# **6.12 Posterization**

## **Description**

Reduces the number of tonal levels.

### **Example**

Original

256 Gray Levels

↓

Posterize

↓

5 Gray Levels

### **Benefits**

* Simplifies painting.  
* Helps identify major value masses.

---

# **6.13 Blur**

## **Description**

Softens image details.

### **Purpose**

Reduce distracting texture.

### **Recommended For**

* Portrait block-in.  
* Background simplification.

---

# **6.14 Sharpen**

## **Description**

Enhances local contrast around edges.

### **Benefits**

* Hair becomes clearer.  
* Eyes appear sharper.  
* Fabric texture improves.

### **Risk**

Too much sharpening introduces noise.

---

# **6.15 Saturation Reduction**

## **Description**

Moves colors toward grayscale.

### **Benefits**

Allows artists to study values before colors.

---

# **6.16 Saturation Increase**

## **Description**

Makes colors richer.

### **Best For**

* Oil painting.  
* Acrylic.  
* Colored pencils.

---

# **6.17 Brightness Increase**

### **Benefits**

* Recover dark faces.  
* Reveal hidden details.

---

# **6.18 Brightness Reduction**

### **Benefits**

* Recover highlights.  
* Improve cloud definition.  
* Better white clothing detail.

---

# **6.19 Contrast Increase**

### **Best For**

* Dramatic portraits.  
* Wildlife.  
* Architecture.

---

# **6.20 Contrast Reduction**

### **Best For**

* Soft portraits.  
* Children.  
* Skin studies.

---

# **6.21 Combined Processing**

Many artists use multiple filters together.

Example workflow:

Original

↓

Brightness \+10

↓

Contrast \+25

↓

Grayscale

↓

Sharpen

↓

Grid

---

# **6.22 Portrait Workflow**

Recommended processing:

* Slight brightness increase.  
* Medium contrast.  
* Desaturate.  
* Sharpen eyes.  
* Medium grid.

Produces:

* Clear facial planes.  
* Better proportions.  
* Easier value study.

---

# **6.23 Animal Drawing Workflow**

Recommended:

* Sharpen.  
* High contrast.  
* Fine grid.

Purpose:

Reveal fur direction.

---

# **6.24 Landscape Workflow**

Recommended:

* Slight saturation increase.  
* Moderate contrast.  
* Large grid.

Purpose:

Preserve atmospheric depth.

---

# **6.25 Architecture Workflow**

Recommended:

* Edge enhancement.  
* High contrast.  
* Fine grid.

Purpose:

Improve line accuracy.

---

# **6.26 Filter Performance**

Each filter has different computational costs.

| Filter | Relative Performance Cost |
| ----- | ----- |
| Brightness | Very Low |
| Contrast | Very Low |
| Saturation | Very Low |
| Grayscale | Low |
| Threshold | Low |
| Blur | Medium |
| Sharpen | Medium |
| Edge Detection | High |
| Pencil Sketch | High |
| Posterization | Medium |

---

# **6.27 Filter Dependencies**

Some filters interact differently when combined.

Example:

Brightness

↓

Contrast

↓

Grayscale

↓

Sharpen

Produces a much cleaner reference than applying Sharpen before Grayscale.

---

# **6.28 Current Strengths**

* Fast.  
* Artist-oriented.  
* Simple.  
* Immediate preview.  
* Minimal learning curve.  
* Integrates well with the grid.

---

# **6.29 Current Weaknesses**

Compared to professional imaging software, the filter system lacks:

* Curves adjustment.  
* Levels adjustment.  
* White balance.  
* Selective color editing.  
* Local brush adjustments.  
* Dodge/Burn.  
* HSL controls.  
* Noise reduction.  
* Clarity.  
* Dehaze.  
* Texture adjustment.  
* Split-toning.  
* Lens correction.

---

# **6.30 Proposed New Filters**

## **AI Contour Detection**

Detect only meaningful drawing lines while ignoring photographic noise.

---

## **Shadow Shape Filter**

Display only major shadow masses.

---

## **Facial Plane Map**

Simplify portraits into major anatomical planes.

---

## **Gesture Filter**

Reduce the image to large directional masses for gesture drawing.

---

## **Color Temperature Filter**

Separate warm and cool color regions to aid painters.

---

## **Material Recognition Filter**

Highlight different materials such as:

* Metal  
* Glass  
* Wood  
* Skin  
* Fabric  
* Hair

---

## **Cross-Hatching Preview**

Generate a simulated ink drawing using directional hatching.

---

## **Value Compression**

Reduce the image to 3, 5, 7, or 9 tonal values for painterly studies.

---

## **Dominant Shape Filter**

Identify and emphasize the largest compositional masses before finer details.

---

## **AI Reference Optimizer**

Automatically analyze the image and recommend the best combination of brightness, contrast, filter, and grid density based on the subject and intended drawing medium.

---

# **6.31 Professional Assessment**

The current filter system successfully addresses the needs of artists preparing reference images, offering quick, non-destructive adjustments that enhance readability. Its strength lies in simplicity and speed. However, expanding the system with intelligent simplification tools, workflow presets, and subject-aware processing would significantly increase its value, bringing it closer to a specialized digital reference preparation suite.

---

# **Stage 7 – Complete Toolbar & Control Reference**

**Application:** Drawing Grid for the Artist v3.0.6 (Android)  
**Version:** 3.0.6 (Reverse Engineered)  
**Document Type:** UI Component & Interaction Specification

---

# **7.1 Overview**

This chapter documents every visible control and interaction pattern observed in the application. Rather than describing screens at a high level, it treats the UI as a collection of reusable components.

Each component is described by:

* Purpose  
* Location  
* Trigger  
* State  
* Dependencies  
* Expected behavior  
* Improvement suggestions

This format is intended to be useful for designers, developers, and QA engineers.

---

# **7.2 Global UI Hierarchy**

The application's runtime interface can be represented as:

Application

│

├── Top App Bar

│

├── Drawing Canvas

│      ├── Reference Image

│      ├── Grid Layer

│      ├── Selection Layer

│      └── Gesture Layer

│

├── Bottom Toolbar

│

├── Modal Panels

│      ├── Filters

│      ├── Grid

│      ├── Adjustments

│      ├── Crop

│      └── Settings

│

└── Dialogs

Unlike most image editors, almost every tool temporarily overlays the canvas instead of navigating to a separate page.

---

# **7.3 Top Toolbar**

The top toolbar contains application-level actions.

## **Responsibilities**

* Import image  
* Save  
* Reset  
* Settings  
* Overflow menu

These actions affect the entire project rather than the currently selected editing tool.

---

## **Component Specification**

| Property | Value |
| ----- | ----- |
| Position | Top |
| Visibility | Persistent |
| Context Sensitive | No |
| Scroll Behavior | Fixed |
| Primary Role | Project Actions |

---

# **7.4 Toolbar Button Lifecycle**

Every toolbar button follows the same interaction model.

Idle

↓

Pressed

↓

Execute Action

↓

Update Canvas

↓

Return to Idle

Consistency across controls reduces the learning curve.

---

# **7.5 Import Button**

## **Purpose**

Loads a new reference image.

---

### **Workflow**

Tap

↓

Open Gallery

↓

Select Image

↓

Decode Bitmap

↓

Display Image

↓

Reset Workspace

---

### **Dependencies**

Requires:

* Gallery permission  
* Valid image

---

### **Possible Failure Cases**

* User cancels picker  
* Unsupported image  
* Corrupted image  
* Out of memory

---

### **Improvement**

Allow:

* Camera import  
* Drag & Drop  
* Clipboard image  
* Multiple images

---

# **7.6 Save Button**

## **Responsibilities**

* Save processed image  
* Preserve current grid  
* Export drawing reference

---

### **Current Workflow**

Tap

↓

Generate Output

↓

Write Storage

↓

Confirmation

---

### **Suggested Improvements**

Support:

* PNG  
* JPG  
* PDF  
* SVG Grid  
* Layer Export

---

# **7.7 Reset Button**

Restores default editing state.

Should affect:

* Filters  
* Brightness  
* Contrast  
* Saturation  
* Rotation  
* Grid

Should NOT delete:

* Imported image

---

# **7.8 Settings Button**

Launches configuration dialog.

Typical hierarchy:

Settings

├── General

├── Grid

├── Display

├── Export

└── About

---

# **7.9 Bottom Toolbar**

The bottom toolbar is context-sensitive.

It dynamically changes according to the selected editing mode.

Typical sections:

* Grid  
* Filters  
* Adjustments  
* Crop  
* Rotate

---

# **7.10 Toolbar Modes**

Unlike Adobe Photoshop, the application activates one editing mode at a time.

Example:

Grid Mode

↓

Only Grid Controls Visible

instead of

Grid

\+

Crop

\+

Brightness

\+

Rotate

Visible Simultaneously

This reduces clutter.

---

# **7.11 Grid Button**

Primary entry point for grid generation.

Responsibilities:

* Open grid settings  
* Enable grid  
* Disable grid  
* Modify appearance

---

### **Dependencies**

Requires:

Imported Image

---

# **7.12 Filter Button**

Launches image processing controls.

Expected interactions:

Tap

↓

Filter List

↓

Preview

↓

Apply

↓

Canvas Refresh

---

# **7.13 Brightness Slider**

## **UI Type**

Continuous Slider

---

### **Behavior**

Move Right

↓

Brighter

Move Left

↓

Darker

---

### **UX Notes**

Should update continuously.

---

# **7.14 Contrast Slider**

Similar behavior.

Positive:

Higher separation

Negative:

Lower separation

---

# **7.15 Saturation Slider**

Controls color intensity.

Left

↓

Gray

Right

↓

More Color

---

# **7.16 Crop Button**

Launches crop mode.

Workflow:

Tap

↓

Display Crop Frame

↓

Resize

↓

Confirm

↓

Re-render Canvas

---

# **7.17 Rotate Button**

Cycles image orientation.

Possible sequence:

0°

↓

90°

↓

180°

↓

270°

---

# **7.18 Flip Button**

Horizontal mirror.

Useful for:

Portrait symmetry.

---

# **7.19 Canvas**

The canvas is the application's most important component.

---

## **Layers**

Labels

↓

Grid

↓

Reference Image

↓

Background

---

## **Gestures**

Supported:

Pinch

Pan

Tap

Long Press (limited)

---

# **7.20 Pinch Zoom**

Expected behavior:

Two Fingers

↓

Distance Changes

↓

Scale Image

↓

Grid Scales Together

---

# **7.21 Pan Gesture**

Moves:

Image

* 

Grid

Together.

---

# **7.22 Double Tap**

Potential uses:

Reset Zoom

or

Zoom to Fit

---

# **7.23 Dialog Components**

Dialogs observed include:

Confirmation

Grid Settings

Filter Selection

Save

About

---

# **7.24 Modal Panel Behavior**

Every panel follows:

Hidden

↓

Slide Up

↓

User Interaction

↓

Apply

↓

Dismiss

---

# **7.25 Slider Components**

Common properties:

Minimum

Maximum

Current Value

Live Preview

Reset

---

# **7.26 Toggle Components**

Used for:

Grid Visibility

Numbering

Filter Enable

Preview

---

# **7.27 Color Picker**

Used by:

Grid Color

Future enhancement:

HSV Picker

Recent Colors

Saved Palette

---

# **7.28 Interaction Dependencies**

Example:

Grid Hidden

↓

Numbering Hidden

because numbering depends on the grid.

---

# **7.29 Control Dependency Graph**

Image

↓

Crop

↓

Rotate

↓

Filters

↓

Grid

↓

Export

Changing an earlier stage may require recalculating later stages.

---

# **7.30 Error Handling**

The UI should gracefully handle:

No Image Loaded

↓

Disable Grid

Disable Filters

Disable Export

rather than showing errors.

---

# **7.31 Current UI Strengths**

✓ Clean interface.

✓ Large canvas.

✓ Beginner friendly.

✓ Fast interaction.

✓ Minimal clutter.

✓ Logical workflow.

---

# **7.32 Current Weaknesses**

✗ Icon-only navigation.

✗ No contextual help.

✗ No keyboard shortcuts.

✗ No toolbar customization.

✗ No accessibility scaling.

✗ Limited undo history.

✗ Few discoverable gestures.

---

# **7.33 Proposed Toolbar Redesign**

## **Current**

────────────────────────

Icons

────────────────────────

Canvas

────────────────────────

Icons

────────────────────────

---

## **Proposed**

────────────────────────

← Project Name      Save

────────────────────────

Canvas

────────────────────────

Reference | Grid | Filters | Draw | Export

────────────────────────

Each section opens a dedicated tool panel, making the interface easier to navigate and extend.

---

# **7.34 Context-Aware Toolbar**

Instead of showing all tools, the toolbar could adapt based on the current workflow stage:

* **No image loaded:** Show only Import.  
* **Image loaded:** Enable Crop, Rotate, Filters.  
* **Grid enabled:** Prioritize Grid customization.  
* **Export mode:** Surface export options and sharing.

This reduces cognitive load and guides users naturally through the workflow.

---

# **7.35 Floating Quick Actions (Proposed)**

Introduce customizable floating actions for frequently used commands:

* Toggle Grid  
* Compare Original/Processed  
* Reset Zoom  
* Lock Pan  
* Screenshot Reference  
* Favorite Filter

Allow users to pin or reorder these actions.

---

# **7.36 Professional Assessment**

The application's control system succeeds because it stays focused on a single task: preparing a drawing reference. Most controls are reachable within one or two taps, and the canvas remains the visual priority.

However, from a product design perspective, there is room for significant improvement:

* Better labeling and discoverability.  
* More customizable toolbars.  
* Richer gesture support.  
* Adaptive controls based on workflow.  
* Accessibility enhancements.  
* Multi-level undo/redo.  
* Workspace personalization.

These refinements would make the application more approachable for beginners while increasing efficiency for experienced artists.

---

# **Stage 8 – Technical Architecture & APK Reverse Engineering**

**Application:** Drawing Grid for the Artist v3.0.6 (Android)  
**Document Type:** Reverse-Engineered Technical Specification

---

# **8.1 Purpose**

This chapter examines the application from a software engineering perspective. Instead of focusing on what users see, it documents how the application is likely structured internally based on:

* APK resource organization  
* Screen recording  
* Runtime behavior  
* Android application architecture  
* Reverse engineering observations

This section is intended for Android developers, software architects, and engineers who want to understand or recreate the application.

---

# **8.2 High-Level Software Architecture**

The application appears to follow a layered architecture rather than a strict MVVM or MVC pattern.

                   UI Layer

────────────────────────────────────

Activity

Toolbar

Dialogs

Bottom Sheets

Canvas

            │

Image Controller Layer

────────────────────────────────────

Import

Crop

Rotate

Filters

Grid Controller

            │

Rendering Layer

────────────────────────────────────

Bitmap Renderer

Canvas Renderer

Grid Renderer

Gesture Renderer

            │

Core Engine

────────────────────────────────────

Image Processing

Grid Generation

Geometry

Coordinate Mapping

            │

Storage Layer

────────────────────────────────────

Gallery

Temporary Cache

Export

Settings

---

# **8.3 Functional Modules**

The application naturally separates into independent modules.

## **Module 1**

Image Import

Responsibilities

* Gallery picker  
* Bitmap decoding  
* Orientation correction  
* Memory allocation

---

## **Module 2**

Image Editor

Responsibilities

* Crop  
* Rotate  
* Flip  
* Scaling

---

## **Module 3**

Image Processor

Responsibilities

* Brightness  
* Contrast  
* Saturation  
* Filters

---

## **Module 4**

Grid Engine

Responsibilities

* Cell generation  
* Numbering  
* Overlay rendering  
* Grid synchronization

---

## **Module 5**

Canvas Engine

Responsibilities

* Zoom  
* Pan  
* Touch handling  
* Display refresh

---

## **Module 6**

Export Manager

Responsibilities

* Save bitmap  
* Export image  
* Gallery integration

---

# **8.4 Android Component Architecture**

A likely implementation consists of the following Android components.

## **Activities**

Likely only one or two Activities.

MainActivity

↓

Editing Workspace

↓

Dialogs

↓

Return

Modern Android applications often use a single activity for interfaces like this.

---

## **Dialogs**

Observed dialogs include

* Save  
* Settings  
* Grid  
* Filters  
* Confirmation

---

## **Custom Views**

The application almost certainly relies on custom rendering components.

Example

DrawingCanvasView

↓

Bitmap Layer

↓

Grid Layer

↓

Gesture Layer

Android's standard ImageView would not provide sufficient flexibility for this workflow.

---

# **8.5 Rendering Pipeline**

The rendering system appears to redraw the canvas whenever state changes.

User Action

↓

Update State

↓

Recalculate

↓

Render Bitmap

↓

Render Grid

↓

Invalidate Canvas

↓

Display

This model aligns with Android's Canvas rendering approach.

---

# **8.6 Bitmap Lifecycle**

Gallery

↓

Bitmap Decode

↓

Memory Allocation

↓

Transform

↓

Filter

↓

Render

↓

Export

↓

Release Memory

Proper bitmap lifecycle management is critical to avoid memory leaks and crashes.

---

# **8.7 Image Processing Engine**

The application most likely maintains several versions of the image.

Original Bitmap

↓

Working Bitmap

↓

Processed Bitmap

↓

Rendered Bitmap

Advantages

* Non-destructive editing  
* Easy reset  
* Faster previews

---

# **8.8 Grid Engine Internals**

The Grid Engine appears independent from image processing.

Bitmap

↓

Image Bounds

↓

Calculate Cells

↓

Generate Lines

↓

Generate Labels

↓

Overlay

This architecture allows image adjustments without regenerating the grid unless image geometry changes.

---

# **8.9 Gesture Engine**

The touch system likely interprets gestures independently of the image.

Touch Event

↓

Gesture Detector

↓

Zoom

↓

Pan

↓

Canvas Update

Android classes commonly used include

* GestureDetector  
* ScaleGestureDetector

---

# **8.10 Rendering Layers**

Observed rendering order

Toolbar

↓

Dialogs

↓

Grid Labels

↓

Grid Lines

↓

Reference Image

↓

Canvas Background

Maintaining this hierarchy prevents the grid from obscuring UI controls.

---

# **8.11 Coordinate System**

The application likely uses floating-point coordinates internally.

Canvas Coordinates

↓

Image Coordinates

↓

Grid Coordinates

↓

Screen Coordinates

Accurate coordinate mapping ensures the grid remains aligned during zooming and panning.

---

# **8.12 Storage Model**

The application stores several types of data.

## **Permanent**

* Exported images  
* User settings

---

## **Temporary**

* Cached bitmaps  
* Undo state  
* Processing buffers

---

# **8.13 Configuration Storage**

Android typically stores application preferences using SharedPreferences or Jetpack DataStore.

Likely settings include

* Grid color  
* Last grid size  
* Theme  
* Recent options

---

# **8.14 Export Pipeline**

Canvas

↓

Merge Layers

↓

Encode Bitmap

↓

Compress

↓

Write File

↓

Notify Gallery

---

# **8.15 Memory Management**

Potential memory-intensive operations

* Large photographs  
* Continuous filtering  
* Zoom  
* Multiple bitmap copies

Best practices include

* Recycling unused bitmaps  
* Downsampling images  
* Hardware acceleration

---

# **8.16 Performance Characteristics**

The application's performance depends primarily on

* Image resolution  
* Active filters  
* Grid density  
* Device GPU  
* Available RAM

Observed behavior suggests good responsiveness for typical smartphone workloads.

---

# **8.17 Permissions**

Typical Android permissions include

### **Media Access**

Required to load images.

---

### **Storage Access**

Required for exporting references.

---

Future versions may also require camera access if live reference capture is added.

---

# **8.18 Security Assessment**

Strengths

* Primarily offline.  
* Minimal network dependency.  
* Limited attack surface.

Potential considerations

* Secure handling of user images.  
* Respect for scoped storage on newer Android versions.  
* Clear privacy disclosures if analytics are introduced.

---

# **8.19 Error Handling**

Robust handling should exist for:

* Corrupted images.  
* Unsupported formats.  
* Low-memory conditions.  
* Storage failures.  
* Permission denial.  
* Interrupted exports.

---

# **8.20 Resource Organization**

A maintainable Android project would typically separate resources as follows:

res/

├── drawable/

├── layout/

├── menu/

├── values/

├── mipmap/

├── color/

├── xml/

└── raw/

Grouping resources by feature rather than type could further improve maintainability in larger projects.

---

# **8.21 Suggested Internal Package Structure**

com.nguyen.drawinggrid

├── ui

│

├── canvas

│

├── image

│

├── filters

│

├── grid

│

├── gestures

│

├── export

│

├── storage

│

├── settings

│

├── utils

│

└── model

This modular organization promotes separation of concerns and easier testing.

---

# **8.22 Architectural Strengths**

* Clear separation between image processing and grid rendering.  
* Non-destructive workflow.  
* Responsive interaction model.  
* Focused feature set.  
* Straightforward user flow.

---

# **8.23 Architectural Weaknesses**

Potential areas for improvement include:

* Limited extensibility for adding new tools.  
* No visible plugin or extension mechanism.  
* No project/document abstraction.  
* No support for multiple reference images.  
* Limited state persistence.  
* Unknown automated testing coverage.

---

# **8.24 Modernization Opportunities**

To future-proof the application, consider:

* Migrating the UI to **Jetpack Compose**.  
* Using **MVVM** with **ViewModel** and **StateFlow**.  
* Replacing SharedPreferences with **DataStore**.  
* Introducing dependency injection (e.g., **Hilt**).  
* Leveraging **WorkManager** for background exports.  
* Using **Room** for project metadata and recent files.  
* Separating image processing into reusable pipeline components.

---

# **8.25 Proposed "Drawing Grid Engine 2.0"**

A next-generation architecture could be organized as:

UI (Compose)

↓

State Management

↓

Workspace Engine

↓

Image Pipeline

↓

Grid Engine

↓

AI Assistant

↓

Export Engine

↓

Persistence Layer

This structure would support future additions such as AI-assisted contour detection, cloud synchronization, project management, and advanced overlays without requiring major architectural changes.

---

# **8.26 Technical Assessment**

From a software engineering standpoint, the application appears to be built around a clean, purpose-driven architecture centered on a responsive editing workspace. Its separation of image processing, grid rendering, and user interaction is appropriate for its scope.

As the application evolves, adopting a more modular architecture with modern Android components and a richer project model would make it easier to maintain, extend, and scale while preserving the simplicity that makes the current version effective.

---

# **Stage 9 – Professional Product Audit (UX, Usability & Competitive Analysis)**

**Application:** Drawing Grid for the Artist v3.0.6  
**Document Type:** Product Design & User Experience Audit

---

# **9.1 Executive Summary**

Drawing Grid for the Artist occupies a niche that surprisingly few Android applications address well: preparing reference images for traditional artists. Rather than competing with digital painting apps such as Krita or ibisPaint, it focuses on a single workflow—helping artists transfer proportions accurately using customizable grids and image adjustments.

Its greatest strengths are:

* Focused workflow.  
* Low learning curve.  
* Fast setup.  
* Minimal distractions.

However, this simplicity comes with trade-offs. The interface is beginning to show its age, and many interactions rely on users discovering icon-only controls through experimentation. The application also lacks project management, workflow guidance, and modern personalization features.

Overall UX maturity: **7.8 / 10**

---

# **9.2 Product Positioning**

The app occupies a space between:

Gallery Apps

        │

        ▼

Drawing Grid

        │

        ▼

Professional Art Software

It is **not** a drawing application and **not** a photo editor. It is a *reference preparation tool*, which is an important distinction that should be reflected more clearly in its branding and onboarding.

---

# **9.3 Target User Personas**

## **Persona 1 – Beginner Artist**

**Goal:** Learn proportion using the grid method.

**Current Experience:**

* Easy to start.  
* Some icons are confusing.  
* No onboarding.

**Pain Points:**

* Unsure which settings to use.  
* Doesn't know what filters are best.

---

## **Persona 2 – Portrait Artist**

**Goal:** Prepare commission references quickly.

**Current Experience:**

* Efficient once familiar.  
* Repeats the same setup each session.

**Pain Points:**

* No saved presets.  
* No project history.  
* No multi-image workflow.

---

## **Persona 3 – Art Teacher**

**Goal:** Demonstrate grid drawing in class.

**Current Experience:**

* Grid is useful.  
* Setup takes time.

**Pain Points:**

* No classroom mode.  
* No presentation mode.  
* Limited export options.

---

## **Persona 4 – Professional Illustrator**

**Goal:** Use the app as part of a larger creative workflow.

**Current Experience:**

* Uses it only for initial reference preparation.

**Pain Points:**

* Cannot manage multiple references.  
* Cannot annotate.  
* No integration with other creative tools.

---

# **9.4 User Journey Analysis**

## **Current Workflow**

Open App

     │

Import Image

     │

Crop

     │

Adjust

     │

Grid

     │

Draw

     │

Export

The workflow is linear and effective but lacks flexibility.

---

## **Proposed Workflow**

Projects

     │

Import References

     │

Choose Drawing Medium

     │

AI Suggestions

     │

Image Optimization

     │

Grid Setup

     │

Workspace

     │

Save Project

     │

Export

This introduces project continuity and intelligent guidance without sacrificing simplicity.

---

# **9.5 Nielsen's 10 Usability Heuristics**

### **1\. Visibility of System Status**

**Score:** 8/10

Strengths:

* Immediate visual feedback for adjustments.

Weaknesses:

* Long-running operations (e.g., export) could provide clearer progress indicators.

---

### **2\. Match Between System and Real World**

**Score:** 9/10

The application uses familiar concepts such as grids, crop, rotate, and brightness, making it intuitive for artists.

---

### **3\. User Control & Freedom**

**Score:** 7/10

Users can adjust most settings, but:

* Undo capabilities appear limited.  
* There is no history panel.  
* Reset options are coarse-grained.

---

### **4\. Consistency & Standards**

**Score:** 8/10

Controls are generally consistent, but:

* Some icons lack labels.  
* Dialog organization varies.

---

### **5\. Error Prevention**

**Score:** 7/10

Potential improvements:

* Warn before replacing an unsaved image.  
* Validate export locations.  
* Disable unavailable actions when no image is loaded.

---

### **6\. Recognition Rather Than Recall**

**Score:** 6/10

This is one of the weakest areas.

Issues:

* Icon-only toolbar.  
* Hidden gestures.  
* Few contextual hints.

Recommendation:

* Optional labels.  
* Tooltips.  
* First-use explanations.

---

### **7\. Flexibility & Efficiency**

**Score:** 7/10

Experienced users work quickly, but the app lacks:

* Presets.  
* Favorites.  
* Keyboard support.  
* Customizable toolbars.

---

### **8\. Aesthetic & Minimalist Design**

**Score:** 9/10

The canvas-first approach is excellent. The interface remains uncluttered, allowing the artwork to stay central.

---

### **9\. Help Users Recover from Errors**

**Score:** 6/10

Potential improvements:

* Better error messages.  
* Recovery suggestions.  
* Export troubleshooting.

---

### **10\. Help & Documentation**

**Score:** 5/10

This is the weakest category.

Missing:

* Interactive tutorial.  
* Guided onboarding.  
* Filter explanations.  
* Grid recommendations.

---

# **9.6 Information Architecture Review**

Current structure:

Image

↓

Adjustments

↓

Grid

↓

Export

The flat structure is simple but does not scale well as features increase.

Recommendation:

Projects

↓

References

↓

Image

↓

Grid

↓

Workspace

↓

Export

↓

Settings

---

# **9.7 Accessibility Audit**

## **Strengths**

* Large canvas.  
* Simple interaction model.  
* Minimal text.

## **Weaknesses**

* Small touch targets.  
* Icon-only navigation.  
* No high-contrast mode.  
* No screen-reader optimization.  
* No dynamic font sizing.

### **Accessibility Score: 6.5 / 10**

---

# **9.8 Visual Design Assessment**

The interface emphasizes function over decoration.

Strengths:

* Clean layout.  
* High canvas priority.  
* Low visual noise.

Areas for improvement:

* More modern typography.  
* Improved iconography.  
* Better spacing.  
* Material Design 3 alignment.  
* Adaptive layouts for tablets and foldables.

---

# **9.9 Competitive Analysis**

| Feature | Drawing Grid | Typical Photo Editor | Professional Drawing App |
| ----- | ----- | ----- | ----- |
| Grid Overlay | ✔ | Limited | ✔ |
| Image Filters | ✔ | ✔ | Limited |
| Drawing Tools | ✖ | ✖ | ✔ |
| Layers | ✖ | Limited | ✔ |
| Project Management | ✖ | Limited | ✔ |
| AI Assistance | ✖ | ✖ | Emerging |
| Perspective Guides | ✖ | ✖ | ✔ |
| Multi-Reference Support | ✖ | ✖ | ✔ |

The application's specialization is its strength, but it could borrow selected features from professional creative software without becoming overly complex.

---

# **9.10 Pain Point Analysis**

| Pain Point | Severity | Frequency |
| ----- | ----- | ----- |
| Icon ambiguity | High | High |
| No project management | High | Medium |
| Repeated setup | High | High |
| No presets | Medium | High |
| No onboarding | Medium | Medium |
| Limited export options | Medium | Medium |
| No comparison mode | Medium | Medium |
| Limited accessibility | Medium | Medium |

---

# **9.11 Prioritized Improvement Backlog**

## **High Impact / Low Effort**

* Add optional icon labels.  
* Save recent grid settings.  
* Introduce filter presets.  
* Improve export feedback.  
* Add first-launch tutorial.

## **High Impact / Medium Effort**

* Project management.  
* Workspace presets.  
* Split-screen comparison.  
* Undo/redo history.  
* Toolbar customization.

## **High Impact / High Effort**

* AI-assisted image optimization.  
* Cloud synchronization.  
* Perspective grids.  
* Multi-reference workspace.  
* Cross-platform support.

---

# **9.12 Design System Recommendations**

To ensure consistency and scalability:

* Adopt Material Design 3 components.  
* Define standardized spacing (e.g., 8dp grid).  
* Create a consistent icon set.  
* Establish typography hierarchy.  
* Introduce reusable color tokens.  
* Define interaction states (hover, pressed, disabled, selected).

---

# **9.13 Branding Assessment**

Current branding communicates utility but not aspiration.

Potential improvements:

* Clearer value proposition ("Professional Reference Preparation for Artists").  
* Stronger visual identity.  
* Showcase example workflows on first launch.  
* Emphasize time savings and drawing accuracy.

---

# **9.14 Overall Product Score**

| Category | Score |
| ----- | ----- |
| Functionality | 9.0 |
| Ease of Use | 8.0 |
| Learnability | 7.0 |
| Performance | 9.0 |
| Accessibility | 6.5 |
| Visual Design | 7.5 |
| Extensibility | 6.5 |
| Workflow Efficiency | 8.5 |

**Overall Product Rating:** **8.0 / 10**

---

# **9.15 Strategic Vision**

The application's core concept is strong. Rather than competing directly with full-featured drawing or photo-editing software, it should deepen its specialization as the definitive companion app for traditional artists.

The next stage will build on this audit by defining a detailed **Product Roadmap and "Drawing Grid 2.0" redesign**, including feature prioritization, modern workflows, AI-assisted capabilities, and a phased development plan from version 3.x through a hypothetical 5.0 release.

---

# **Stage 10 – Product Requirements Document (PRD)**

## **Drawing Grid 2.0**

**Document Type:** Product Requirements Document (PRD)  
**Product:** Drawing Grid for the Artist  
**Target Version:** 4.0 → 5.0 Evolution  
**Audience:** Product Managers, Android Developers, UX Designers, QA Engineers, Investors

---

# **10.1 Executive Summary**

Drawing Grid has established itself as a capable utility for artists preparing reference images. However, its current scope is limited to basic image adjustment and grid overlays.

**Drawing Grid 2.0** aims to evolve it into a complete **Reference Preparation Studio** while preserving its defining strengths: simplicity, speed, and artist-focused workflows.

The vision is **not** to compete with Photoshop, Procreate, or ibisPaint. Instead, it should become the *best companion application* for traditional artists, illustrators, tattoo designers, art educators, and students.

---

# **10.2 Product Vision**

> **"Help artists spend less time preparing references and more time creating art."**

Core principles:

* Fast  
* Non-destructive  
* Professional  
* Beginner-friendly  
* AI-assisted (never AI-dependent)  
* Cross-device ready

---

# **10.3 Product Goals**

### **Primary Goals**

* Reduce setup time by 50%.  
* Improve drawing accuracy.  
* Make complex references easier to study.  
* Support multiple artistic workflows.  
* Modernize the user experience.

### **Secondary Goals**

* Build reusable projects.  
* Encourage long-term engagement.  
* Enable educational use.  
* Support professional commissions.

---

# **10.4 Success Metrics (KPIs)**

| Metric | Current | Target |
| ----- | ----- | ----- |
| Time to first grid | \~30 sec | \<10 sec |
| Sessions ending with export | Baseline | \+40% |
| Daily active users | Baseline | \+25% |
| Saved presets per user | 0 | \>3 |
| Crash rate | Baseline | \<0.5% |
| User rating | Current | ≥4.8★ |

---

# **10.5 Target Audience**

### **Primary**

* Traditional artists  
* Portrait artists  
* Pencil sketch artists  
* Charcoal artists  
* Tattoo designers

### **Secondary**

* Art teachers  
* Architecture students  
* Hobbyists  
* Comic artists  
* Sculpture students

---

# **10.6 User Stories**

### **As a Beginner**

> I want the app to recommend grid settings so I don't need to guess.

**Acceptance Criteria**

* Detect subject type.  
* Suggest grid density.  
* Explain the recommendation.  
* Allow one-tap application.

---

### **As a Portrait Artist**

> I want reusable presets so I can prepare every commission consistently.

**Acceptance Criteria**

* Save preset.  
* Rename preset.  
* Edit preset.  
* Delete preset.  
* Apply with one tap.

---

### **As an Art Teacher**

> I want presentation mode so students can clearly see the reference.

**Acceptance Criteria**

* Large labels.  
* High-contrast grid.  
* Lock accidental gestures.  
* Quick zoom controls.

---

### **As a Professional**

> I want multiple references open simultaneously.

**Acceptance Criteria**

* Add/remove images.  
* Reorder references.  
* Split-screen view.  
* Synchronize zoom if desired.

---

# **10.7 Functional Requirements**

## **FR-01 Project System**

### **Description**

Introduce persistent projects.

Project contains:

* Original images.  
* Edited versions.  
* Grid configuration.  
* Notes.  
* Export history.

Priority: **Must Have**

---

## **FR-02 Workspace Presets**

Allow users to save complete configurations.

Includes:

* Grid size.  
* Color.  
* Opacity.  
* Filters.  
* Brightness.  
* Contrast.  
* Export settings.

Priority: **Must Have**

---

## **FR-03 AI Reference Optimization**

Automatically analyze imported images.

Suggest:

* Best brightness.  
* Best contrast.  
* Recommended filter.  
* Recommended grid density.

Priority: **Should Have**

---

## **FR-04 Perspective Guides**

Support:

* One-point.  
* Two-point.  
* Three-point.

Priority: **Should Have**

---

## **FR-05 Multiple Reference Workspace**

Allow:

* Side-by-side references.  
* Overlay comparison.  
* Split view.  
* Reference tabs.

Priority: **Must Have**

---

## **FR-06 Annotation Layer**

Allow users to:

* Draw arrows.  
* Circle details.  
* Write notes.  
* Highlight features.

Priority: **Should Have**

---

## **FR-07 Export Profiles**

Examples:

* Instagram.  
* A4 Print.  
* Classroom.  
* High Resolution.  
* Transparent Grid.

Priority: **Must Have**

---

## **FR-08 Smart Crop**

Automatically detect:

* Faces.  
* Subjects.  
* Artwork boundaries.

Priority: **Could Have**

---

# **10.8 Non-Functional Requirements**

| Requirement | Target |
| ----- | ----- |
| Startup Time | \<2 sec |
| Filter Preview | \<100 ms |
| Grid Update | \<16 ms |
| Export | \<5 sec |
| Memory Usage | \<300 MB |
| Battery Impact | Low |

---

# **10.9 UI/UX Redesign**

## **New Home Screen**

\+--------------------------------------+

| Drawing Grid                         |

|--------------------------------------|

| Continue Project                     |

| New Project                          |

| Open Gallery                         |

| Recent Projects                      |

| Tutorials                            |

| Settings                             |

\+--------------------------------------+

---

## **New Workspace**

\+---------------------------------------------------+

| ← Project Name                   Save      Export |

\+---------------------------------------------------+

|                                               |

|               Reference Canvas                |

|                                               |

\+---------------------------------------------------+

| Image | Grid | Guides | Filters | Notes | Export |

\+---------------------------------------------------+

This layout improves discoverability while maintaining focus on the artwork.

---

# **10.10 AI Features**

### **Smart Grid**

Automatically chooses:

* Number of cells.  
* Color.  
* Opacity.

---

### **Portrait Assistant**

Highlights:

* Eye line.  
* Nose line.  
* Mouth line.  
* Face proportions.

---

### **Composition Assistant**

Overlay options:

* Rule of Thirds.  
* Golden Ratio.  
* Dynamic Symmetry.  
* Leading Lines.

---

### **Shadow Assistant**

Automatically group shadows into:

* 3 values.  
* 5 values.  
* 7 values.

---

# **10.11 Feature Prioritization (MoSCoW)**

## **Must Have**

* Projects  
* Presets  
* Multiple references  
* Better export  
* Undo/Redo  
* Toolbar redesign  
* Accessibility improvements

## **Should Have**

* AI optimization  
* Perspective guides  
* Annotation tools  
* Workspace customization  
* Cloud backup

## **Could Have**

* Live camera mode  
* Collaboration  
* AI contour detection  
* Timelapse recording  
* Plugin support

## **Won't Have (Initially)**

* Full painting tools  
* Layer-based illustration  
* Animation features

These remain outside the product's core focus.

---

# **10.12 Release Roadmap**

## **Version 4.0**

* Project system  
* Presets  
* Better export  
* Modern UI  
* Accessibility improvements

## **Version 4.5**

* Multi-reference workspace  
* Annotation layer  
* Perspective guides  
* New filters

## **Version 5.0**

* AI optimization  
* Cloud synchronization  
* Collaboration  
* Plugin architecture  
* Desktop companion

---

# **10.13 Risks & Mitigations**

| Risk | Impact | Mitigation |
| ----- | ----- | ----- |
| Feature bloat | High | Keep "Simple Mode" as default |
| Performance degradation | High | Use GPU acceleration and lazy rendering |
| AI suggestions reduce user trust | Medium | Make AI optional and explain recommendations |
| Increased maintenance cost | Medium | Modular architecture and automated testing |
| Compatibility issues | Medium | Target recent Android APIs while testing older devices |

---

# **10.14 Success Metrics After Launch**

Monitor:

* Feature adoption (presets, projects, AI suggestions).  
* Average session duration.  
* Export completion rate.  
* User retention after 7 and 30 days.  
* Crash-free sessions.  
* App store ratings and reviews.  
* Most frequently used workflows.

---

# **10.15 Long-Term Vision**

Drawing Grid should become the **standard reference preparation tool** for artists, much like Lightroom is for photographers. Its identity should remain focused on helping users prepare, analyze, and study references—not replacing their preferred drawing application or traditional medium.

---

# **10.16 Technical Recommendations**

To support this vision:

* Adopt a modular architecture (MVVM \+ Jetpack Compose).  
* Build a reusable image-processing pipeline.  
* Separate rendering, grid, guides, and annotations into independent layers.  
* Use GPU acceleration where appropriate.  
* Design a plugin-ready extension system for future tools and guides.

---

# **10.17 Product Milestones**

| Milestone | Focus |
| ----- | ----- |
| M1 | Modern UI foundation |
| M2 | Project & preset management |
| M3 | Enhanced guides and multi-reference support |
| M4 | AI-assisted reference preparation |
| M5 | Cross-device sync and extensibility |

---

# **Stage 11 – Drawing Grid 5.0 Master Design Specification**

**Application:** Drawing Grid for the Artist (Android)  
**Version Documented:** 3.0.6 (Reverse Engineered)  
**Proposed Future Version:** 5.0  
**Document Type:** Master Product Specification

---

# **11.1 Executive Summary**

This document represents the complete reverse engineering and redesign proposal for **Drawing Grid for the Artist**.

The application successfully solves a focused problem: helping artists prepare reference images using customizable grids and image adjustments. Rather than expanding into a full drawing application, the proposed evolution preserves this identity while modernizing the experience and broadening its capabilities.

---

# **11.2 Product Mission**

**Mission**

> Enable artists to prepare, analyze, study, and transfer reference images with maximum accuracy and minimum effort.

**Vision**

Become the industry-standard reference preparation application for traditional artists, educators, and creative professionals.

---

# **11.3 Product Pillars**

Every feature should support one or more of these pillars:

| Pillar | Description |
| ----- | ----- |
| Simplicity | Fast, intuitive workflows with minimal setup. |
| Accuracy | Precise grids, guides, and image transformations. |
| Performance | Smooth interaction even on mid-range devices. |
| Education | Help users learn artistic fundamentals. |
| Flexibility | Adapt to different mediums and workflows. |
| Extensibility | Architecture that accommodates future growth. |

---

# **11.4 Functional Coverage Matrix**

| Area | Current | Proposed |
| ----- | ----- | ----- |
| Grid Overlay | ✔ | ✔ Enhanced |
| Image Adjustments | ✔ | ✔ Expanded |
| Filters | ✔ | ✔ AI-Assisted |
| Guides | Limited | ✔ Perspective, Golden Ratio, Rule of Thirds |
| Projects | ✖ | ✔ |
| Presets | ✖ | ✔ |
| Multi-Reference | ✖ | ✔ |
| Annotation | ✖ | ✔ |
| AI Assistance | ✖ | ✔ |
| Cloud Sync | ✖ | ✔ |
| Desktop Companion | ✖ | Future |

---

# **11.5 Complete Feature Inventory**

### **Image Management**

* Import from gallery  
* Camera capture  
* Drag-and-drop (future)  
* Clipboard paste  
* Multiple references  
* Project folders  
* Image collections  
* Version history

---

### **Image Editing**

* Crop  
* Rotate  
* Flip  
* Brightness  
* Contrast  
* Saturation  
* Sharpness  
* Edge enhancement  
* Value simplification  
* Histogram  
* Curves  
* Levels  
* White balance  
* Noise reduction  
* AI optimization

---

### **Grid System**

* Rectangular grids  
* Perspective grids  
* Radial grids  
* Isometric grids  
* Rule of Thirds  
* Golden Ratio  
* Dynamic Symmetry  
* Custom guides  
* Grid presets  
* Adjustable opacity  
* Labels  
* Snapping

---

### **Workspace**

* Split view  
* Multi-reference  
* Lock gestures  
* Workspace presets  
* Annotation layer  
* Full-screen mode  
* Presentation mode

---

### **Export**

* PNG  
* JPEG  
* PDF  
* SVG  
* Layer export  
* Print layouts  
* Classroom layouts  
* Social media presets

---

# **11.6 User Experience Principles**

1. Canvas First  
2. One-Hand Friendly  
3. Non-Destructive Editing  
4. Progressive Disclosure  
5. Immediate Feedback  
6. Consistency Across Tools  
7. Accessibility by Default

---

# **11.7 Design System**

## **Color Palette**

* Neutral backgrounds  
* High-contrast grid colors  
* Accent color for active tools  
* Color-blind-safe indicators

---

## **Typography**

* Clear hierarchy  
* Adjustable font sizes  
* Consistent spacing

---

## **Icons**

* Labelled by default for new users  
* Optional icon-only mode for experienced users

---

## **Spacing**

* 8dp layout grid  
* Large touch targets  
* Tablet-aware scaling

---

# **11.8 Navigation Model**

Home

 │

 ├── Projects

 ├── Import

 ├── Recent

 ├── Tutorials

 └── Settings

Project

 │

 ├── References

 ├── Image

 ├── Grid

 ├── Guides

 ├── Notes

 ├── Export

 └── History

---

# **11.9 Technical Architecture**

Presentation Layer

        │

Workspace State

        │

Image Pipeline

        │

Grid Engine

        │

Guide Engine

        │

Annotation Engine

        │

AI Engine

        │

Persistence Layer

Each subsystem should be independently testable and reusable.

---

# **11.10 Data Model**

### **Project**

* Name  
* Created Date  
* Last Modified  
* Thumbnail  
* Tags

### **Reference**

* Original Image  
* Edited Image  
* Grid Preset  
* Guide Preset  
* Notes

### **Preset**

* Grid  
* Filters  
* Adjustments  
* Export Settings

---

# **11.11 AI Roadmap**

### **Phase 1**

* Smart brightness  
* Smart contrast  
* Grid recommendation

### **Phase 2**

* Contour extraction  
* Shadow grouping  
* Perspective estimation

### **Phase 3**

* Pose analysis  
* Facial landmarks  
* Material recognition  
* Automatic composition suggestions

---

# **11.12 Educational Features**

To strengthen its appeal to students and teachers:

* Interactive tutorials  
* Guided exercises  
* Grid method lessons  
* Value studies  
* Perspective exercises  
* Progress tracking  
* Classroom mode

---

# **11.13 Quality Assurance Strategy**

Testing should include:

* Unit tests for image processing.  
* UI tests for workflows.  
* Performance tests with high-resolution images.  
* Accessibility testing.  
* Regression testing for export and grid alignment.  
* Device compatibility testing across Android versions and screen sizes.

---

# **11.14 Accessibility Goals**

* Screen reader support.  
* Adjustable text size.  
* High-contrast themes.  
* Color-blind-friendly palettes.  
* Stylus optimization.  
* Larger touch targets.  
* Reduced-motion option.

---

# **11.15 Performance Targets**

| Metric | Target |
| ----- | ----- |
| Cold start | \<2 s |
| Filter preview | \<100 ms |
| Grid redraw | 60 FPS |
| Export (12 MP image) | \<5 s |
| Memory usage | \<300 MB |

---

# **11.16 Security & Privacy**

* Offline-first processing.  
* Minimal permissions.  
* Scoped storage compliance.  
* Transparent privacy policy.  
* Optional cloud sync with user consent.  
* No image uploads without explicit action.

---

# **11.17 Development Roadmap**

### **Version 4.0**

* Modern UI  
* Projects  
* Presets  
* Accessibility improvements

### **Version 4.5**

* Multi-reference workspace  
* Perspective guides  
* Annotation layer  
* Expanded export options

### **Version 5.0**

* AI assistance  
* Cloud synchronization  
* Plugin framework  
* Desktop companion

---

# **11.18 Risks**

* Feature creep.  
* Performance regression.  
* Increased maintenance complexity.  
* Balancing simplicity with advanced capabilities.

Mitigation strategies include modular architecture, feature flags, and user testing at each milestone.

---

# **11.19 Final Product Evaluation**

| Category | Score |
| ----- | ----- |
| Core Concept | 9.5/10 |
| Workflow Efficiency | 8.5/10 |
| Performance | 9.0/10 |
| Learnability | 8.0/10 |
| Accessibility | 6.5/10 |
| Extensibility | 8.5/10 |
| Overall Potential | **9.2/10** |

The application's niche focus is its greatest strength. By expanding thoughtfully rather than trying to become a full digital art suite, it can become the definitive reference preparation tool for artists.

---

# **11.20 Conclusion**

This concludes the reverse engineering and redesign specification. Across all stages, the document covered:

* Reverse-engineered UI and workflow.  
* Grid engine behavior.  
* Image processing pipeline.  
* Filter analysis.  
* Settings architecture.  
* Toolbar and interaction model.  
* Technical architecture.  
* UX and product audit.  
* Product Requirements Document.  
* Long-term product roadmap.  
* Master design specification.

---

# **Appendix A – Suggested Future Modules**

* Live camera grid overlay.  
* AR-assisted canvas alignment.  
* Perspective calibration wizard.  
* Timelapse project playback.  
* Apple Pencil / Android stylus enhancements.  
* Desktop companion application.  
* Plugin marketplace.  
* Community preset sharing.  
* Reference board (mood board) creation.  
* Voice-controlled presentation mode.

---

# **Appendix B – Potential Integrations**

* Cloud storage providers.  
* Print services.  
* Learning platforms.  
* External stylus APIs.  
* Companion desktop software.  
* Open file formats for interoperability.

---

# **Appendix C – If Rebuilding From Scratch**

If this application were to be rebuilt today, a recommended technology stack would be:

* **UI:** Jetpack Compose with Material Design 3\.  
* **Architecture:** MVVM \+ Clean Architecture.  
* **Dependency Injection:** Hilt.  
* **Persistence:** Room \+ DataStore.  
* **Image Processing:** GPU-accelerated pipeline where appropriate.  
* **Testing:** JUnit, Espresso, Macrobenchmark.  
* **CI/CD:** GitHub Actions or similar automated pipeline.  
* **Analytics:** Privacy-first, opt-in usage metrics.

---

