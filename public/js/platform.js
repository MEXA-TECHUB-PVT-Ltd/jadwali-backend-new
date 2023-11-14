document.addEventListener("DOMContentLoaded", () => {
  const type = window.platformType;

  // Paths and data for each platform type
  const platformData = {
    google: {
      image: "google.png",
      features: [
        "Feature 1 for Google",
        "Feature 2 for Google",
        "Feature 3 for Google",
      ],
      requirements: [
        "Requirement 1 for Google",
        "Requirement 2 for Google",
        "Requirement 3 for Google",
      ],
    },
    zoom: {
      image: "zoom.png",
      features: [
        "Feature 1 for Zoom",
        "Feature 2 for Zoom",
        "Feature 3 for Zoom",
      ],
      requirements: [
        "Requirement 1 for Zoom",
        "Requirement 2 for Zoom",
        "Requirement 3 for Zoom",
      ],
    },
  };

  const platformInfo = platformData[type];

  // Check if platform type is valid
  if (!platformInfo) {
    console.error("Invalid platform type");
    return;
  }

  // Set the image source
  const img = document.querySelector(".img");
  img.src = `/public/images/${platformInfo.image}`;

  // Populate the features and requirements lists
  const featuresList = document.getElementById("features-list");
  const requirementsList = document.getElementById("requirements-list");

  platformInfo.features.forEach((feature) => {
    const li = document.createElement("li");
    li.textContent = feature;
    featuresList.appendChild(li);
  });

  platformInfo.requirements.forEach((requirement) => {
    const li = document.createElement("li");
    li.textContent = requirement;
    requirementsList.appendChild(li);
  });
});
