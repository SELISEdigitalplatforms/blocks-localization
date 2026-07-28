using System.Reflection;
using BlocksTemplate.Api.Controllers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ApplicationModels;
using Xunit;

namespace XUnitTest
{
    public class GlobalApiRoutePrefixConventionTests
    {
        private static IApplicationModelConvention CreateConvention(string prefix)
        {
            var type = typeof(KeyController).Assembly
                .GetType("BlocksTemplate.Api.GlobalApiRoutePrefixConvention")!;
            return (IApplicationModelConvention)Activator.CreateInstance(
                type, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                null, new object[] { prefix }, null)!;
        }

        private static (ApplicationModel app, SelectorModel selector) BuildApplication(string? routeTemplate)
        {
            var app = new ApplicationModel();
            var controller = new ControllerModel(typeof(KeyController).GetTypeInfo(), new List<object>());
            var selector = new SelectorModel
            {
                AttributeRouteModel = routeTemplate == null
                    ? null
                    : new AttributeRouteModel(new RouteAttribute(routeTemplate))
            };
            controller.Selectors.Add(selector);
            app.Controllers.Add(controller);
            return (app, selector);
        }

        [Fact]
        public void Apply_PrependsPrefixToExistingRouteTemplate()
        {
            var convention = CreateConvention("api");
            var (app, selector) = BuildApplication("[controller]");

            convention.Apply(app);

            selector.AttributeRouteModel!.Template.Should().Be("api/[controller]");
        }

        [Fact]
        public void Apply_WhenSelectorHasNoRoute_LeavesItNull()
        {
            var convention = CreateConvention("api");
            var (app, selector) = BuildApplication(null);

            convention.Apply(app);

            selector.AttributeRouteModel.Should().BeNull();
        }
    }
}
