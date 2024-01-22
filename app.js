const express = require("express");
const bodyParser = require("body-parser");
const date = require(__dirname + "/date.js");
const mongoose = require("mongoose");

const app = express();
app.use(express.static(__dirname + "/public"));

app.use(express.json()); // Add this line to parse JSON in the request body

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

mongoose.connect("mongodb://127.0.0.1:27017/trial8DB", {
  useNewUrlParser: true,
});

const port = 3000;

const defaultList = {
  title: "To Do List",
  items: [],
};

const customListSchema = new mongoose.Schema({
  title: String,
  items: [String],
  deletedItems: [String],
  creationDate: {
    type: Date,
    default: Date.now,
  },
});

const CustomList = mongoose.model("CustomList", customListSchema);

app.get("/", async (req, res) => {
  try {
    const customLists = await CustomList.find({}).sort({ creationDate: -1 });
    const groupedLists = groupListsByDate(customLists);
    res.render("list", {
      defaultList: defaultList,
      customLists: customLists,
      groupedLists: groupedLists,
      activeListName: null,
      activeList: null,
    });
  } catch (error) {
    console.error(error);
    res.redirect("/");
  }
});

// Add similar routes for other pages
app.get("/about", (req, res) => {
  res.render("about");
});

app.get("/contact", (req, res) => {
  res.render("contact");
});

app.get("/help", (req, res) => {
  res.render("help");
});

app.get("/faq", (req, res) => {
  res.render("faq");
});

app.post("/", async (req, res) => {
  const listItem = req.body.listItemInput;
  const listName = req.body.listName;

  if (listName === defaultList.title) {
    defaultList.items.push(listItem);
    res.redirect("/");
  } else {
    try {
      let customList = await CustomList.findOne({ title: listName });

      if (customList) {
        customList.items.push(listItem);
        await customList.save();
      } else {
        const existingCustomList = await CustomList.findOne({
          title: listName,
        });

        if (existingCustomList) {
          customList = existingCustomList;
          customList.items.push(listItem);
          await customList.save();
        } else {
          customList = new CustomList({
            title: listName,
            items: [listItem],
            deletedItems: [],
          });
          await customList.save();
        }
      }

      res.redirect("/customList/" + encodeURIComponent(listName));
    } catch (error) {
      console.error(error);
      res.redirect("/");
    }
  }
});

app.post("/customListName", async (req, res) => {
  const customListTitle = req.body.customListTitle;

  try {
    const existingCustomList = await CustomList.findOne({
      title: customListTitle,
    });

    if (existingCustomList) {
      res.redirect("/customList/" + encodeURIComponent(customListTitle));
    } else {
      const customList = new CustomList({
        title: customListTitle,
        items: [],
        deletedItems: [],
      });

      await customList.save();
      res.redirect("/customList/" + encodeURIComponent(customListTitle));
    }
  } catch (error) {
    console.error(error);
    res.redirect("/");
  }
});

app.post("/customList/:listName", async (req, res) => {
  const listName = req.params.listName;
  const itemIndex = req.body.itemIndex;

  try {
    let customList = await CustomList.findOne({ title: listName });
    if (customList) {
      // Move the deleted item from items to deletedItems
      const deletedItem = customList.items.splice(itemIndex, 1);
      customList.deletedItems.push(deletedItem[0]);
      await customList.save();
      res.redirect("/customList/" + encodeURIComponent(listName));
    } else {
      res.redirect("/");
    }
  } catch (error) {
    console.error(error);
    res.redirect("/");
  }
});

app.get("/customList/:listName", async (req, res) => {
  const listName = req.params.listName;
  const deletedItemIndex = req.query.deletedItemIndex;

  try {
    let customList = await CustomList.findOne({ title: listName });

    if (customList) {
      // Sort the items array alphabetically
      customList.items.sort();

      // Remove the deleted item from deletedItems and add it back to items
      if (deletedItemIndex !== undefined) {
        const deletedItem = customList.deletedItems.splice(deletedItemIndex, 1);
        customList.items.push(deletedItem[0]);
      }

      customList.deletedItems.sort(); // Sort deletedItems array alphabetically

      await customList.save();

      const customLists = await CustomList.find({}).sort({ creationDate: -1 });
      const groupedLists = groupListsByDate(customLists);
      res.render("list", {
        defaultList: defaultList,
        customLists: customLists,
        groupedLists: groupedLists,
        activeListName: listName,
        activeList: customList,
      });
    } else {
      res.redirect("/");
    }
  } catch (error) {
    console.error(error);
    res.redirect("/");
  }
});

app.post("/restoreItems/:listName", async (req, res) => {
  const listName = req.params.listName;
  const deletedItemIndexes = JSON.parse(req.body.deletedItemIndexes);

  try {
    let customList = await CustomList.findOne({ title: listName });

    if (customList && deletedItemIndexes && deletedItemIndexes.length > 0) {
      const restoredItems = [];

      deletedItemIndexes.sort((a, b) => b - a); // Sort indexes in descending order

      deletedItemIndexes.forEach((index) => {
        if (index >= 0 && index < customList.deletedItems.length) {
          const deletedItem = customList.deletedItems.splice(index, 1);
          restoredItems.push(deletedItem[0]);
        }
      });

      // Add the restored items back to the items array in the correct order
      customList.items.splice(
        deletedItemIndexes[deletedItemIndexes.length - 1],
        0,
        ...restoredItems
      );

      await customList.save();
    }

    res.redirect("/customList/" + encodeURIComponent(listName));
  } catch (error) {
    console.error(error);
    res.redirect("/");
  }
});

app.post("/deleteList/:listId", async (req, res) => {
  const listId = req.params.listId;

  try {
    await CustomList.findOneAndDelete({ _id: listId });
    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.redirect("/");
  }
});

function groupListsByDate(customLists) {
  const groupedLists = {};
  customLists.forEach((list) => {
    const formattedDate = list.creationDate
      ? list.creationDate.toDateString()
      : "Date Not Available";
    if (!groupedLists[formattedDate]) {
      groupedLists[formattedDate] = [];
    }
    groupedLists[formattedDate].push(list);
  });

  // Sort the lists within each date group based on creation time (newest first)
  for (const dateGroup in groupedLists) {
    groupedLists[dateGroup].sort((a, b) => b.creationDate - a.creationDate);
  }

  return groupedLists;
}

app.post("/updateListTitle/:listId", async (req, res) => {
  const listId = req.params.listId;
  const { newTitle } = req.body;

  try {
    let customList = await CustomList.findOne({ _id: listId });

    if (customList) {
      console.log("Received new title:", newTitle);
      customList.title = newTitle;
      await customList.save();
      console.log("Updated title:", customList.title);
      res.json({ success: true, newTitle: customList.title });
    } else {
      res.json({ success: false, error: "List not found." });
    }
  } catch (error) {
    console.error(error);
    res.json({ success: false, error: "An error occurred." });
  }
});

app.post("/deleteDate/:timestamp", async (req, res) => {
  const timestamp = req.params.timestamp;

  try {
    // Convert the timestamp back to a JavaScript Date object
    const dateToDelete = new Date(parseInt(timestamp, 10));

    console.log("Deleting lists for date:", dateToDelete);

    // Create a date range for the entire day of the specified date
    const startOfDay = new Date(dateToDelete);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(dateToDelete);
    endOfDay.setHours(23, 59, 59, 999);

    // Find and delete all lists within the date range
    const result = await CustomList.deleteMany({
      creationDate: { $gte: startOfDay, $lte: endOfDay },
    });

    console.log("Deletion result:", result);

    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.redirect("/");
  }
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
