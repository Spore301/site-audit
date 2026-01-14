const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../data/database.sqlite'),
    logging: false // Toggle to true to see SQL queries
});

module.exports = sequelize;
