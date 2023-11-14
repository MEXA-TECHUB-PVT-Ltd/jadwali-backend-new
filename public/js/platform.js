document.addEventListener("DOMContentLoaded", () => {
  const type = window.platformType;

  // Paths and data for each platform type
  const platformData = {
    google: {
      image: "google.png",
      features: [
        "Automatically create Google meetings at the time an event is scheduled.",
        "Instantly share unique conferencing details upon confirmation.",
      ],
      requirements: ["A Google account"],
    },
    zoom: {
      image: "zoom.png",
      features: [
        "Automatically create Zoom meetings at the time an event is scheduled.",
        "Instantly share unique conferencing details upon confirmation.",
      ],
      requirements: [
        "A Zoom account",
        "Your Zoom account administrator must pre-approve Calendly in the Zoom Marketplace",
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
