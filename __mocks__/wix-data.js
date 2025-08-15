module.exports = {
  save: jest.fn(),
  insert: jest.fn(),
  query: jest.fn(() => ({ eq: jest.fn(() => ({ find: jest.fn() })) })),
};
